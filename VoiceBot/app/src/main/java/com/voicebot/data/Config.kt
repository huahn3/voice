package com.voicebot.data

import org.json.JSONArray
import org.json.JSONObject

data class TapAction(
    val label: String = "",
    val x: Int = 0,
    val y: Int = 0,
    val type: ActionType = ActionType.TAP,
    val holdMs: Int = 0,
    val delayAfterMs: Int = 500
) {
    enum class ActionType { TAP, HOLD, SWIPE_UP, SWIPE_DOWN }
}

data class VoiceMessage(
    val text: String = "大家好",
    val audioFilePath: String = "",
    val ttsEnabled: Boolean = true,
    val durationSeconds: Int = 3,
    val method: VoiceMethod = VoiceMethod.SPEAKER
) {
    enum class VoiceMethod { SPEAKER, MAIDMIC }
}

data class BotConfig(
    val intervalSeconds: Int = 300,
    val actions: List<TapAction> = listOf(
        TapAction("Hold PTT", 540, 600, TapAction.ActionType.HOLD, 3000, 2000)
    ),
    val randomizeTaps: Boolean = true,
    val jitterPixels: Int = 3,
    val enabled: Boolean = false,
    val useMethod: TapMethod = TapMethod.INPUT,
    val voice: VoiceMessage = VoiceMessage()
) {
    enum class TapMethod { INPUT, SENDEVENT }

    fun toJson(): String {
        val arr = JSONArray()
        actions.forEach { a ->
            arr.put(JSONObject().apply {
                put("label", a.label)
                put("x", a.x)
                put("y", a.y)
                put("type", a.type.name)
                put("holdMs", a.holdMs)
                put("delayAfterMs", a.delayAfterMs)
            })
        }
        return JSONObject().apply {
            put("intervalSeconds", intervalSeconds)
            put("actions", arr)
            put("randomizeTaps", randomizeTaps)
            put("jitterPixels", jitterPixels)
            put("enabled", enabled)
            put("useMethod", useMethod.name)
            put("voice", JSONObject().apply {
                put("text", voice.text)
                put("audioFilePath", voice.audioFilePath)
                put("ttsEnabled", voice.ttsEnabled)
                put("durationSeconds", voice.durationSeconds)
                put("method", voice.method.name)
            })
        }.toString(2)
    }

    companion object {
        fun fromJson(json: String): BotConfig {
            val obj = JSONObject(json)
            val arr = obj.getJSONArray("actions")
            val actions = mutableListOf<TapAction>()
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                actions.add(TapAction(
                    label = a.optString("label", ""),
                    x = a.getInt("x"),
                    y = a.getInt("y"),
                    type = TapAction.ActionType.valueOf(a.optString("type", "TAP")),
                    holdMs = a.optInt("holdMs", 0),
                    delayAfterMs = a.optInt("delayAfterMs", 500)
                ))
            }
            val v = obj.optJSONObject("voice") ?: JSONObject()
            val seconds = if (obj.has("intervalSeconds")) {
                obj.getInt("intervalSeconds")
            } else {
                obj.optInt("intervalMinutes", 5) * 60
            }
            return BotConfig(
                intervalSeconds = seconds,
                actions = actions,
                randomizeTaps = obj.optBoolean("randomizeTaps", true),
                jitterPixels = obj.optInt("jitterPixels", 3),
                enabled = obj.optBoolean("enabled", false),
                useMethod = TapMethod.valueOf(obj.optString("useMethod", "INPUT")),
                voice = VoiceMessage(
                    text = v.optString("text", "大家好"),
                    audioFilePath = v.optString("audioFilePath", ""),
                    ttsEnabled = v.optBoolean("ttsEnabled", true),
                    durationSeconds = v.optInt("durationSeconds", 3),
                    method = VoiceMessage.VoiceMethod.valueOf(v.optString("method", "SPEAKER"))
                )
            )
        }
    }
}
