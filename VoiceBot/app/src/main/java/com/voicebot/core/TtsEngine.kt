package com.voicebot.core

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.io.File
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

object TtsEngine {
    private const val TAG = "TtsEngine"
    private var tts: TextToSpeech? = null
    private var initialized = false
    private var lastError = ""

    fun getLastError() = lastError

    suspend fun init(context: Context): Boolean = suspendCoroutine { cont ->
        if (initialized) { cont.resume(true); return@suspendCoroutine }
        tts = TextToSpeech(context) { status ->
            initialized = (status == TextToSpeech.SUCCESS)
            if (initialized) {
                val langResult = tts?.setLanguage(Locale.CHINESE) ?: TextToSpeech.LANG_NOT_SUPPORTED
                when (langResult) {
                    TextToSpeech.LANG_MISSING_DATA -> {
                        lastError = "缺少中文语音数据，请在设置中下载"
                        initialized = false
                    }
                    TextToSpeech.LANG_NOT_SUPPORTED -> {
                        lastError = "设备不支持中文TTS"
                        initialized = false
                    }
                    else -> lastError = ""
                }
            } else {
                lastError = "TTS引擎初始化失败(status=$status)"
            }
            cont.resume(initialized)
        }
    }

    suspend fun generateAudio(context: Context, text: String): File? {
        if (!initialized) {
            val ok = init(context)
            if (!ok) return null
        }
        val engine = tts ?: run {
            lastError = "TTS引擎未初始化"
            return null
        }
        val cacheDir = File(context.cacheDir, "voicebot_tts")
        cacheDir.mkdirs()
        val outputFile = File(cacheDir, "tts_${UUID.randomUUID()}.wav")

        return suspendCoroutine { cont ->
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(uttId: String?) {}
                override fun onDone(uttId: String?) {
                    if (outputFile.exists() && outputFile.length() > 0) {
                        cont.resume(outputFile)
                    } else {
                        lastError = "TTS生成的文件为空"
                        cont.resumeWithException(Exception(lastError))
                    }
                }
                override fun onError(uttId: String?) {
                    lastError = "TTS合成失败"
                    cont.resumeWithException(Exception(lastError))
                }
                override fun onError(uttId: String?, errorCode: Int) {
                    lastError = "TTS合成错误(code=$errorCode)"
                    cont.resumeWithException(Exception(lastError))
                }
            })
            val params = Bundle()
            val result = engine.synthesizeToFile(text, params, outputFile, "utt_${UUID.randomUUID()}")
            if (result != TextToSpeech.SUCCESS) {
                lastError = "synthesizeToFile返回错误码=$result"
                cont.resumeWithException(Exception(lastError))
            }
        }
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        initialized = false
        lastError = ""
    }
}
