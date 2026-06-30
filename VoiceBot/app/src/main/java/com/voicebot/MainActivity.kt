package com.voicebot

import android.content.Intent
import android.media.MediaPlayer
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
            slider.valueFrom = 5f   // 5 seconds minimum
            slider.valueTo = 3600f  // 3600 seconds max (60 min)
            slider.stepSize = 1f
            slider.addOnChangeListener { _, value, _ ->
                config = config.copy(intervalSeconds = value.toInt())
                ConfigStore.save(this, config)
                updateIntervalLabel()
            }
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

        // Pick audio file
        findViewById<com.google.android.material.button.MaterialButton>(R.id.btnPickAudio).setOnClickListener {
            audioPickerLauncher.launch("audio/*")
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
        super.onDestroy()
    }
}
