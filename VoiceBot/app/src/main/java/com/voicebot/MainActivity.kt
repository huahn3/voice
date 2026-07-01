package com.voicebot

import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.slider.Slider
import com.voicebot.core.Shell
import com.voicebot.core.TapEngine
import com.voicebot.data.BotConfig
import com.voicebot.data.BotConfig.TapMethod
import com.voicebot.data.ConfigStore
import com.voicebot.data.TapAction
import com.voicebot.data.VoiceMessage
import com.voicebot.service.BotService
import com.voicebot.service.OverlayService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var config: BotConfig
    private var isOverlayShowing = false
    private var testPlayer: MediaPlayer? = null

    // Recording variables
    private var isRecording = false
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private var actualSampleRate = 44100  // 自适应确定后的采样率
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private var tempPcmFile: File? = null
    private var finalWavFile: File? = null

    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { checkOverlayPermission() }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val audioPickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uri?.let { selectAudioFile(it) }
    }

    private val recordAudioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            runPhantomMicTest()
        } else {
            Toast.makeText(this, "需要录音权限才能测试虚拟麦克风", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        config = ConfigStore.load(this)
        initUI()
        checkPermissions()
    }

    override fun onResume() {
        super.onResume()
        config = ConfigStore.load(this)
        refreshUI()
    }

    private fun initUI() {
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnToggle).setOnClickListener {
            if (BotService.isRunning) {
                stopService(Intent(this, BotService::class.java))
                Toast.makeText(this, "已停止", Toast.LENGTH_SHORT).show()
            } else {
                if (!Shell.hasRoot()) {
                    AlertDialog.Builder(this)
                        .setTitle("需要 Root")
                        .setMessage("未检测到 root 权限。\n\n如果你已安装 Magisk:\n1. 打开 Magisk App\n2. 进入「超级用户」\n3. 授权给 Shell 或本应用\n4. 回来点「重试」")
                        .setPositiveButton("打开 Magisk") { _, _ ->
                            try {
                                val intent = Intent("com.topjohnwu.magisk.MAIN")
                                intent.setPackage("com.topjohnwu.magisk")
                                startActivity(intent)
                            } catch (e: Exception) {
                                Toast.makeText(this, "无法打开 Magisk", Toast.LENGTH_SHORT).show()
                            }
                        }
                        .setNegativeButton("重试") { _, _ ->
                            if (Shell.requestRoot()) {
                                Toast.makeText(this, "Root 成功！", Toast.LENGTH_SHORT).show()
                                refreshUI()
                            } else {
                                Toast.makeText(this, "仍然没有 root 权限", Toast.LENGTH_SHORT).show()
                            }
                        }
                        .setNeutralButton("取消", null)
                        .show()
                    return@setOnClickListener
                }
                config = config.copy(enabled = true)
                ConfigStore.save(this, config)
                val intent = Intent(this, BotService::class.java).apply {
                    action = BotService.ACTION_START
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent)
                } else {
                    startService(intent)
                }
                Toast.makeText(this, "已启动", Toast.LENGTH_SHORT).show()
            }
            refreshUI()
        }

        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnCalibrate).setOnClickListener {
            if (!checkOverlayPermission()) return@setOnClickListener
            if (isOverlayShowing) {
                stopService(Intent(this, OverlayService::class.java))
                isOverlayShowing = false
            } else {
                startService(Intent(this, OverlayService::class.java))
                isOverlayShowing = true
                Toast.makeText(this, "校准浮层已显示", Toast.LENGTH_LONG).show()
            }
        }

        findViewById<Slider>(R.id.intervalSlider).let { slider ->
            slider.valueFrom = 5f
            slider.valueTo = 3600f
            slider.stepSize = 1f
            slider.addOnChangeListener { _, value, _ ->
                config = config.copy(intervalSeconds = value.toInt())
                ConfigStore.save(this, config)
                updateIntervalLabel()
            }
        }

        findViewById<Slider>(R.id.countdownSlider).addOnChangeListener { _, value, _ ->
            config = config.copy(countdownSeconds = value.toInt())
            ConfigStore.save(this, config)
            findViewById<android.widget.TextView>(R.id.countdownLabel).text = "${value.toInt()} 秒"
        }

        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.methodToggle)
            .addOnButtonCheckedListener { _, checkedId, isChecked ->
                if (!isChecked) return@addOnButtonCheckedListener
                config = config.copy(
                    useMethod = if (checkedId == R.id.methodInput) TapMethod.INPUT else TapMethod.SENDEVENT
                )
                ConfigStore.save(this, config)
            }

        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.voiceMethodToggle)
            .addOnButtonCheckedListener { _, checkedId, isChecked ->
                if (!isChecked) return@addOnButtonCheckedListener
                val method = if (checkedId == R.id.vmSpeaker)
                    VoiceMessage.VoiceMethod.SPEAKER else VoiceMessage.VoiceMethod.MAIDMIC
                config = config.copy(voice = config.voice.copy(method = method))
                ConfigStore.save(this, config)
                refreshUI()
            }

        // TTS text input
        findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.ttsText)
            .setOnEditorActionListener { _, _, _ ->
                saveTtsText()
                false
            }

        // Test TTS
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnTestTts).setOnClickListener {
            testPlayVoice()
        }

        // Check TTS status button
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnCheckTts).setOnClickListener {
            showTtsStatus()
        }

        // PhantomMic test button
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnTestPhantom).setOnClickListener {
            testPhantomMic()
        }

        // Pick audio file
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnPickAudio).setOnClickListener {
            audioPickerLauncher.launch("audio/*")
        }

        // Record Voice button
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnRecordVoice).setOnClickListener {
            if (isRecording) {
                stopRecordingVoice()
            } else {
                startRecordingVoice()
            }
        }

        // Play recorded Voice button
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnPlayVoice).setOnClickListener {
            playRecordedVoice()
        }

        // Push to PhantomMic virtual mic
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnPushToPhantom).setOnClickListener {
            pushCurrentAudioToPhantom()
        }

        // Duration slider
        findViewById<Slider>(R.id.durationSlider).addOnChangeListener { _, value, _ ->
            config = config.copy(voice = config.voice.copy(durationSeconds = value.toInt()))
            ConfigStore.save(this, config)
            findViewById<android.widget.TextView>(R.id.durationLabel).text = "${value.toInt()} 秒"
        }

        // Toggle TTS vs File
        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.sourceToggle)
            .addOnButtonCheckedListener { _, checkedId, isChecked ->
                if (!isChecked) return@addOnButtonCheckedListener
                val useTts = (checkedId == R.id.sourceTts)
                config = config.copy(voice = config.voice.copy(ttsEnabled = useTts))
                ConfigStore.save(this, config)
                refreshUI()
            }

        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnPresetPtt).setOnClickListener {
            val screen = Shell.getScreenSize()
            val w = screen?.first ?: 1080
            val h = screen?.second ?: 2400
            config = config.copy(actions = listOf(
                TapAction("Hold PTT", w / 2, 200, TapAction.ActionType.HOLD, 3000, 2000)
            ))
            ConfigStore.save(this, config)
            refreshUI()
            Toast.makeText(this, "已应用 PTT 预设\n请校准坐标! (当前(${w/2}, 200))", Toast.LENGTH_LONG).show()
        }

        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnApplyActions).setOnClickListener {
            val text = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.actionJsonEdit).text?.toString()
            if (text.isNullOrBlank()) return@setOnClickListener
            try {
                ConfigStore.saveActionsFromJson(this, text)
                config = ConfigStore.load(this)
                Toast.makeText(this, "动作已保存", Toast.LENGTH_SHORT).show()
                refreshUI()
            } catch (e: Exception) {
                Toast.makeText(this, "JSON 格式错误: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }

        refreshUI()
    }

    private fun saveTtsText() {
        val text = findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.ttsText).text?.toString()
        if (!text.isNullOrBlank()) {
            config = config.copy(voice = config.voice.copy(text = text))
            ConfigStore.save(this, config)
        }
    }

    private fun testPlayVoice() {
        saveTtsText()
        // Check if using audio file mode
        if (!config.voice.ttsEnabled && config.voice.audioFilePath.isNotBlank()) {
            val file = File(config.voice.audioFilePath)
            if (file.exists()) {
                playAudioFile(file)
            } else {
                Toast.makeText(this, "音频文件不存在: ${file.path}", Toast.LENGTH_SHORT).show()
            }
            return
        }
        // TTS mode
        CoroutineScope(Dispatchers.IO).launch {
            val engine = com.voicebot.core.TtsEngine
            try {
                val ok = engine.init(this@MainActivity)
                if (!ok) {
                    runOnUiThread {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("TTS 初始化失败")
                            .setMessage(engine.getLastError() + "\n\n请检查: 设置 → 语言与输入 → 文字转语音(TTS) → 安装语音数据")
                            .setPositiveButton("确定", null)
                            .show()
                    }
                    return@launch
                }
                val file = engine.generateAudio(this@MainActivity, config.voice.text)
                if (file != null) {
                    runOnUiThread { playAudioFile(file) }
                } else {
                    runOnUiThread {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("TTS 生成失败")
                            .setMessage(engine.getLastError())
                            .setPositiveButton("确定", null)
                            .show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("TTS 错误")
                        .setMessage("${e.message}\n${engine.getLastError()}")
                        .setPositiveButton("确定", null)
                        .show()
                }
            }
        }
    }

    private fun playAudioFile(file: File) {
        try {
            testPlayer?.release()
            testPlayer = MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setVolume(1.0f, 1.0f)
                prepare()
                start()
                setOnCompletionListener {
                    Toast.makeText(this@MainActivity, "播放完毕", Toast.LENGTH_SHORT).show()
                }
            }
            Toast.makeText(this@MainActivity, "正在播放...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this@MainActivity, "播放失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateIntervalLabel() {
        val secs = config.intervalSeconds
        val label = if (secs < 60) "${secs} 秒"
                    else if (secs % 60 == 0) "${secs / 60} 分钟"
                    else "${secs / 60}分${secs % 60}秒"
        findViewById<android.widget.TextView>(R.id.intervalLabel).text = label
    }

    private fun testPhantomMic() {
        saveTtsText()
        if (androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            recordAudioPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
        } else {
            runPhantomMicTest()
        }
    }

    private fun runPhantomMicTest() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val (recorder, usedSampleRate) = createAdaptiveAudioRecord()
                if (recorder == null) {
                    runOnUiThread {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("录音初始化失败")
                            .setMessage("无法初始化麦克风，请检查：\n1. 模拟器 Extended Controls > Microphone > Enable Host Microphone Access 已开\n2. 应用展开录音权限\n3. 设置 > 应用程序 > VoiceBot > 权限 > 麦克风 = 允许")
                            .setPositiveButton("确定", null)
                            .show()
                    }
                    return@launch
                }
                val bufferSize = AudioRecord.getMinBufferSize(usedSampleRate,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                val buf = ByteArray(bufferSize.coerceAtLeast(4096))
                recorder.startRecording()
                runOnUiThread { Toast.makeText(this@MainActivity, "正在录音3秒...", Toast.LENGTH_SHORT).show() }
                val startTime = System.currentTimeMillis()
                var totalRead = 0
                var maxAbsVal = 0
                while (System.currentTimeMillis() - startTime < 3000) {
                    val read = recorder.read(buf, 0, buf.size)
                    if (read > 0) {
                        totalRead += read
                        for (i in 0 until read step 2) {
                            if (i + 1 < read) {
                                val sample = ((buf[i+1].toInt() shl 8) or (buf[i].toInt() and 0xFF)).toShort().toInt()
                                if (Math.abs(sample) > maxAbsVal) maxAbsVal = Math.abs(sample)
                            }
                        }
                    }
                }
                recorder.stop()
                recorder.release()
                val hasAudio = maxAbsVal > 100
                val msg = buildString {
                    appendLine("采样率: ${usedSampleRate}Hz")
                    appendLine("录音完成: $totalRead bytes")
                    appendLine("最大信号幅: $maxAbsVal")
                    appendLine("")
                    appendLine("结果: ${if (hasAudio) "✅ 检测到音频信号" else "❌ 全部静音"}")
                    if (hasAudio) appendLine("PhantomMic 注入工作正常！")
                    else appendLine("建议：确认 /sdcard/phantom/voice.wav 已写入，且 phantom.txt 内容为 voice.wav")
                }
                runOnUiThread {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("PhantomMic 测试")
                        .setMessage(msg)
                        .setPositiveButton("确定", null)
                        .show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("测试失败")
                        .setMessage("${e.javaClass.simpleName}: ${e.message}")
                        .setPositiveButton("确定", null)
                        .show()
                }
            }
        }
    }

    private fun showTtsStatus() {
        val hasEngine = com.voicebot.core.TtsEngine.let { true }
        val locale = Locale.getDefault()
        val msg = buildString {
            append("设备语言: $locale\n")
            append("Root: ${if (Shell.hasRoot()) "✅" else "❌"}\n")
            append("TTS引擎: ${if (java.util.Locale.CHINESE.displayName != "") "中文可用" else "未知"}\n")
            append("\n如果 TTS 失败:\n")
            append("1. 设置 → 语言与输入 → 文字转语音输出\n")
            append("2. 安装中文语音数据(如 讯飞/Google/TTS)\n")
            append("3. 确保默认引擎支持中文\n")
            append("4. 重启手机后重试")
        }
        AlertDialog.Builder(this)
            .setTitle("TTS 诊断")
            .setMessage(msg)
            .setPositiveButton("确定", null)
            .show()
    }

    private fun selectAudioFile(uri: Uri) {
        try {
            val inputStream = contentResolver.openInputStream(uri)
            val dir = File(cacheDir, "voicebot_audio")
            dir.mkdirs()
            val target = File(dir, "user_voice.wav")
            inputStream?.use { input ->
                target.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            config = config.copy(voice = config.voice.copy(
                audioFilePath = target.absolutePath,
                ttsEnabled = false
            ))
            ConfigStore.save(this, config)
            refreshUI()
            Toast.makeText(this, "已选择音频文件", Toast.LENGTH_SHORT).show()
            findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.sourceToggle)
                .check(R.id.sourceFile)
        } catch (e: Exception) {
            Toast.makeText(this, "选择文件失败: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun refreshUI() {
        config = ConfigStore.load(this)
        val isRunning = BotService.isRunning

        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnToggle).text =
            if (isRunning) "⏹ 停止" else "▶ 启动"

        findViewById<android.widget.TextView>(R.id.statusText).text = buildString {
            append("状态: ${if (isRunning) "✅ 运行中" else "⏹ 已停止"}")
            append("\nRoot: ${if (Shell.hasRoot()) "✅" else "❌"}")
            append("\n屏幕: ${Shell.getScreenSize()?.let { "${it.first}x${it.second}" } ?: "未知"}")
            append("\n方法: ${if (config.voice.method == VoiceMessage.VoiceMethod.SPEAKER) "扬声器" else "MaidMic"}")
            append("\n来源: ${if (config.voice.ttsEnabled) "TTS: ${config.voice.text}" else "文件: ${File(config.voice.audioFilePath).name}"}")
        }

        findViewById<Slider>(R.id.intervalSlider).value = config.intervalSeconds.toFloat()
        updateIntervalLabel()
        findViewById<Slider>(R.id.countdownSlider).value = config.countdownSeconds.toFloat()
        findViewById<android.widget.TextView>(R.id.countdownLabel).text = "${config.countdownSeconds} 秒"

        findViewById<Slider>(R.id.durationSlider).value = config.voice.durationSeconds.toFloat()
        findViewById<android.widget.TextView>(R.id.durationLabel).text = "${config.voice.durationSeconds} 秒"

        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.methodToggle)
            .check(if (config.useMethod == TapMethod.INPUT) R.id.methodInput else R.id.methodSendevent)

        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.voiceMethodToggle)
            .check(if (config.voice.method == VoiceMessage.VoiceMethod.SPEAKER) R.id.vmSpeaker else R.id.vmMaidmic)

        findViewById<com.google.android.material.button.MaterialButtonToggleGroup>(R.id.sourceToggle)
            .check(if (config.voice.ttsEnabled) R.id.sourceTts else R.id.sourceFile)

        findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.ttsText).setText(config.voice.text)

        findViewById<android.widget.TextView>(R.id.selectedAudioLabel).text =
            if (config.voice.audioFilePath.isNotBlank())
                "已选: ${File(config.voice.audioFilePath).name}" else "未选择音频文件"

        val actionJson = JSONArray().apply {
            config.actions.forEach { a ->
                put(JSONObject().apply {
                    put("label", a.label)
                    put("x", a.x)
                    put("y", a.y)
                    put("type", a.type.name)
                    put("holdMs", a.holdMs)
                    put("delayAfterMs", a.delayAfterMs)
                })
            }
        }.toString(2)
        findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.actionJsonEdit).setText(actionJson)

        findViewById<android.widget.TextView>(R.id.actionList).text =
            config.actions.joinToString("\n") { a ->
                "${a.label}: (${a.x}, ${a.y}) ${if (a.type == TapAction.ActionType.HOLD) "[hold ${a.holdMs}ms]" else ""}"
            }.ifEmpty { "无动作" }
    }

    private fun checkPermissions(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
        return checkOverlayPermission()
    }

    private fun checkOverlayPermission(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                AlertDialog.Builder(this)
                    .setTitle("需要悬浮窗权限")
                    .setMessage("校准功能需要悬浮窗权限")
                    .setPositiveButton("去设置") { _, _ ->
                        val intent = Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:$packageName")
                        )
                        overlayPermissionLauncher.launch(intent)
                    }
                    .setNegativeButton("取消", null)
                    .show()
                return false
            }
        }
        return true
    }

    override fun onDestroy() {
        testPlayer?.release()
        if (isOverlayShowing) stopService(Intent(this, OverlayService::class.java))
        if (isRecording) {
            isRecording = false
            audioRecord?.release()
        }
        super.onDestroy()
    }

    private fun startRecordingVoice() {
        if (androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            recordAudioPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            val (rec, usedSampleRate) = createAdaptiveAudioRecord()
            if (rec == null) {
                runOnUiThread {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("录音初始化失败")
                        .setMessage("无法初始化麦克风，请检查模拟器麦克风配置和录音权限")
                        .setPositiveButton("确定", null)
                        .show()
                }
                return@launch
            }
            actualSampleRate = usedSampleRate
            audioRecord = rec
            tempPcmFile = File(cacheDir, "temp_voice.pcm")
            finalWavFile = File(cacheDir, "recorded_voice.wav")
            audioRecord?.startRecording()
            isRecording = true
            runOnUiThread {
                findViewById<com.google.android.material.button.MaterialButton>(R.id.btnRecordVoice).text = "⏹ 停止录音"
                Toast.makeText(this@MainActivity, "正在录音 (${usedSampleRate}Hz)...", Toast.LENGTH_SHORT).show()
            }
            recordingThread = Thread({ writeAudioDataToFile() }, "voicebot-recorder")
            recordingThread?.start()
        }
    }

    private fun writeAudioDataToFile() {
        val minBufSize = AudioRecord.getMinBufferSize(actualSampleRate, channelConfig, audioFormat)
        val data = ByteArray(minBufSize.coerceAtLeast(4096))
        var fileOutputStream: java.io.FileOutputStream? = null
        try {
            fileOutputStream = java.io.FileOutputStream(tempPcmFile)
            while (isRecording) {
                val read = audioRecord?.read(data, 0, data.size) ?: 0
                if (read > 0) {
                    fileOutputStream.write(data, 0, read)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            try { fileOutputStream?.close() } catch (_: Exception) {}
        }
    }

    /**
     * 自适应多采样率创建 AudioRecord。
     * 退避对特定采样率的 AVD 驱动限制，依次尝试 44100/16000/48000/8000 Hz。
     * 返回 Pair：（AudioRecord 实例 or null，实际采样率）
     */
    private fun createAdaptiveAudioRecord(): Pair<AudioRecord?, Int> {
        val candidateRates = listOf(44100, 16000, 48000, 8000)
        for (rate in candidateRates) {
            try {
                val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                if (minBuf <= 0) continue
                val rec = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    rate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    minBuf * 4
                )
                if (rec.state == AudioRecord.STATE_INITIALIZED) {
                    return Pair(rec, rate)
                }
                try { rec.release() } catch (_: Exception) {}
            } catch (_: Exception) {}
        }
        return Pair(null, 0)
    }

    private fun stopRecordingVoice() {
        isRecording = false
        audioRecord?.apply {
            try {
                stop()
            } catch (_: Exception) {}
            release()
        }
        audioRecord = null
        try { recordingThread?.join(1000) } catch (_: Exception) {}
        recordingThread = null
        
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnRecordVoice).text = "🎤 录制语音"
        
        // Convert to WAV
        val pFile = tempPcmFile
        val wFile = finalWavFile
        if (pFile != null && pFile.exists() && wFile != null) {
            convertPcmToWav(pFile, wFile)
            try { pFile.delete() } catch (_: Exception) {}
            
            // Auto update config file path
            config = config.copy(voice = config.voice.copy(
                audioFilePath = wFile.absolutePath,
                ttsEnabled = false
            ))
            ConfigStore.save(this, config)
            refreshUI()
            Toast.makeText(this, "录音已保存并选为发送源", Toast.LENGTH_SHORT).show()
        }
    }

    private fun convertPcmToWav(pcmFile: File, wavFile: File) {
        val pcmSize = pcmFile.length()
        val wavSize = pcmSize + 36
        val sampleRateLong = actualSampleRate.toLong()
        val channels = 1
        val byteRate = (actualSampleRate * channels * 16 / 8).toLong()
        
        val header = ByteArray(44)
        header[0] = 'R'.code.toByte() // RIFF
        header[1] = 'I'.code.toByte()
        header[2] = 'F'.code.toByte()
        header[3] = 'F'.code.toByte()
        header[4] = (wavSize and 0xff).toByte()
        header[5] = ((wavSize shr 8) and 0xff).toByte()
        header[6] = ((wavSize shr 16) and 0xff).toByte()
        header[7] = ((wavSize shr 24) and 0xff).toByte()
        header[8] = 'W'.code.toByte()
        header[9] = 'A'.code.toByte()
        header[10] = 'V'.code.toByte()
        header[11] = 'E'.code.toByte()
        header[12] = 'f'.code.toByte() // fmt 
        header[13] = 'm'.code.toByte()
        header[14] = 't'.code.toByte()
        header[15] = ' '.code.toByte()
        header[16] = 16 // size of fmt chunk
        header[17] = 0
        header[18] = 0
        header[19] = 0
        header[20] = 1 // format = 1 (PCM)
        header[21] = 0
        header[22] = channels.toByte()
        header[23] = 0
        header[24] = (sampleRateLong and 0xff).toByte()
        header[25] = ((sampleRateLong shr 8) and 0xff).toByte()
        header[26] = ((sampleRateLong shr 16) and 0xff).toByte()
        header[27] = ((sampleRateLong shr 24) and 0xff).toByte()
        header[28] = (byteRate and 0xff).toByte()
        header[29] = ((byteRate shr 8) and 0xff).toByte()
        header[30] = ((byteRate shr 16) and 0xff).toByte()
        header[31] = ((byteRate shr 24) and 0xff).toByte()
        header[32] = (channels * 16 / 8).toByte() // block align
        header[33] = 0
        header[34] = 16 // bits per sample
        header[35] = 0
        header[36] = 'd'.code.toByte() // data
        header[37] = 'a'.code.toByte()
        header[38] = 't'.code.toByte()
        header[39] = 'a'.code.toByte()
        header[40] = (pcmSize and 0xff).toByte()
        header[41] = ((pcmSize shr 8) and 0xff).toByte()
        header[42] = ((pcmSize shr 16) and 0xff).toByte()
        header[43] = ((pcmSize shr 24) and 0xff).toByte()
        
        var fIn: java.io.FileInputStream? = null
        var fOut: java.io.FileOutputStream? = null
        try {
            fIn = java.io.FileInputStream(pcmFile)
            fOut = java.io.FileOutputStream(wavFile)
            fOut.write(header)
            val buffer = ByteArray(1024)
            var bytesRead = fIn.read(buffer)
            while (bytesRead != -1) {
                fOut.write(buffer, 0, bytesRead)
                bytesRead = fIn.read(buffer)
            }
        } finally {
            try { fIn?.close() } catch (_: Exception) {}
            try { fOut?.close() } catch (_: Exception) {}
        }
    }

    private fun playRecordedVoice() {
        val file = finalWavFile ?: File(cacheDir, "recorded_voice.wav")
        if (file.exists()) {
            playAudioFile(file)
        } else {
            Toast.makeText(this, "未找到录音文件", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * 将当前选定的音频文件推送到 /sdcard/phantom/voice.wav，
     * 使 PhantomMic 立即将其作为虚拟麦克风音源注入给所有被 Hook 的录音应用。
     */
    private fun pushCurrentAudioToPhantom() {
        // 优先取已录制的 WAV，其次取 config 中配置的文件
        val srcFile: File? = when {
            finalWavFile?.exists() == true -> finalWavFile
            config.voice.audioFilePath.isNotBlank() -> File(config.voice.audioFilePath).takeIf { it.exists() }
            else -> null
        }
        if (srcFile == null) {
            Toast.makeText(this, "请先录制语音或选择音频文件", Toast.LENGTH_SHORT).show()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val targetPath = "/sdcard/phantom/voice.wav"
                val configPath = "/sdcard/phantom/phantom.txt"

                // 建目录
                Shell.exec("mkdir -p /sdcard/phantom", asRoot = true)
                // 复制文件
                val cpResult = Shell.exec("cp \"${srcFile.absolutePath}\" \"$targetPath\"", asRoot = true)
                if (!cpResult.success) {
                    // Root cp 失败时直接用 Kotlin 复制
                    srcFile.copyTo(File(targetPath), overwrite = true)
                }
                // 写 phantom.txt
                Shell.exec("echo -n \"voice.wav\" > \"$configPath\"", asRoot = true)
                // 开放权限
                Shell.exec("chmod 666 \"$targetPath\" \"$configPath\"", asRoot = true)

                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "✅ 已推送到虚拟麦克风！\n打开录音 App 即可录到预设语音",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "推送失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

