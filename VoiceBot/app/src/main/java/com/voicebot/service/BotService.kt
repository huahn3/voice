package com.voicebot.service

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.MediaPlayer.OnCompletionListener
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.voicebot.MainActivity
import com.voicebot.R
import com.voicebot.core.Shell
import com.voicebot.core.TapEngine
import com.voicebot.core.TtsEngine
import com.voicebot.data.BotConfig
import com.voicebot.data.ConfigStore
import com.voicebot.data.VoiceMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class BotService : Service() {
    companion object {
        const val CHANNEL_ID = "voicebot_channel"
        const val NOTIF_ID = 1001
        const val ACTION_START = "com.voicebot.START"
        const val ACTION_STOP = "com.voicebot.STOP"
        const val ACTION_TICK = "com.voicebot.TICK"
        const val TAG = "BotService"
        var isRunning = false
            private set
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private var job: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaPlayer: MediaPlayer? = null
    private lateinit var config: BotConfig

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                config = ConfigStore.load(this)
                if (!config.enabled) return START_NOT_STICKY
                if (!TapEngine.testRoot()) {
                    Log.w(TAG, "No root access!")
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIF_ID, buildNotification(true))
                isRunning = true
                Log.d(TAG, "Service started")
                scheduleNext()
            }
            ACTION_STOP -> stop()
            ACTION_TICK -> if (isRunning) executeAndSchedule()
        }
        return START_STICKY
    }

    private fun executeAndSchedule() {
        job = scope.launch {
            acquireWakeLock()
            try {
                config = ConfigStore.load(this@BotService)
                if (!config.enabled) { stop(); return@launch }

                val audioFile = prepareAudio()
                if (audioFile != null && audioFile.exists()) {
                    sendVoiceMessage(audioFile)
                } else {
                    TapEngine.execute(config)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Execution error", e)
            } finally {
                releaseWakeLock()
                if (isRunning) scheduleNext()
            }
        }
    }

    private suspend fun prepareAudio(): File? {
        val voice = config.voice
        if (voice.ttsEnabled && voice.text.isNotBlank()) {
            return TtsEngine.generateAudio(this, voice.text)
        }
        if (voice.audioFilePath.isNotBlank()) {
            val f = File(voice.audioFilePath)
            if (f.exists()) return f
        }
        return null
    }

    private suspend fun sendVoiceMessage(audioFile: File) {
        val voice = config.voice
        val pttAction = config.actions.firstOrNull { it.type == com.voicebot.data.TapAction.ActionType.HOLD }
            ?: return
        val durationMs = (voice.durationSeconds * 1000).coerceAtLeast(1000)

        // Copy audio to MaidMic if configured
        if (voice.method == VoiceMessage.VoiceMethod.MAIDMIC) {
            copyToMaidMic(audioFile)
            delay(1500)
        }

        // Start playing audio through speaker
        if (voice.method == VoiceMessage.VoiceMethod.SPEAKER) {
            startAudioPlayback(audioFile, durationMs)
        }

        // Hold PTT button
        val tx = pttAction.x + (if (config.randomizeTaps) (Math.random() * config.jitterPixels * 2 - config.jitterPixels).toInt() else 0)
        val ty = pttAction.y + (if (config.randomizeTaps) (Math.random() * config.jitterPixels * 2 - config.jitterPixels).toInt() else 0)
        Shell.exec("input swipe $tx $ty $tx $ty $durationMs")

        // Wait for audio to finish
        if (voice.method == VoiceMessage.VoiceMethod.SPEAKER) {
            mediaPlayer?.setOnCompletionListener {
                synchronized(this) { (this as java.lang.Object).notify() }
            }
            synchronized(this) { (this as java.lang.Object).wait(durationMs + 2000L) }
        }
    }

    private fun startAudioPlayback(audioFile: File, durationMs: Int) {
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build())
                setDataSource(audioFile.absolutePath)
                setVolume(1.0f, 1.0f)
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Playback failed", e)
        }
    }

    private fun copyToMaidMic(audioFile: File) {
        try {
            val maidDir = File("/sdcard/phantom")
            if (!maidDir.exists()) maidDir.mkdirs()
            val target = File(maidDir, "voice.wav")
            audioFile.copyTo(target, overwrite = true)
            File(maidDir, "phantom.txt").writeText("voice.wav")
            Shell.exec("chmod 777 ${target.absolutePath}", asRoot = true)
            Shell.exec("chmod 777 ${File(maidDir, "phantom.txt").absolutePath}", asRoot = true)
            Log.d(TAG, "Copied to MaidMic: ${target.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "MaidMic copy failed", e)
        }
    }

    private fun scheduleNext() {
        config = ConfigStore.load(this)
        if (!config.enabled) { stop(); return }
        val alarmMgr = getSystemService(ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, BotService::class.java).apply { action = ACTION_TICK }
        val pending = PendingIntent.getService(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        try {
            alarmMgr.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + config.intervalSeconds * 1000L, pending)
        } catch (e: SecurityException) {
            alarmMgr.set(AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + config.intervalSeconds * 1000L, pending)
        }
        updateNotification(config.intervalSeconds)
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VoiceBot:Wakelock")
        }
        wakeLock?.acquire(120_000L)
    }

    private fun releaseWakeLock() {
        try { wakeLock?.release() } catch (_: Exception) {}
    }

    private fun stop() {
        isRunning = false
        job?.cancel()
        mediaPlayer?.release()
        mediaPlayer = null
        TtsEngine.shutdown()
        releaseWakeLock()
        val alarmMgr = getSystemService(ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, BotService::class.java).apply { action = ACTION_TICK }
        val pending = PendingIntent.getService(this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        alarmMgr.cancel(pending)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        mediaPlayer?.release()
        TtsEngine.shutdown()
        scope.cancel()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Bot Service",
                NotificationManager.IMPORTANCE_LOW).apply {
                description = "Background automation service"
                setShowBadge(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(running: Boolean): Notification {
        val stopIntent = PendingIntent.getService(this, 1,
            Intent(this, BotService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val openIntent = PendingIntent.getActivity(this, 2,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (running) "⏺ 运行中" else "⏹ 已停止")
            .setContentText("定时执行语音操作")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(running)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_media_pause, "停止", stopIntent)
            .build()
    }

    private fun updateNotification(intervalMin: Int) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(true))
    }
}
