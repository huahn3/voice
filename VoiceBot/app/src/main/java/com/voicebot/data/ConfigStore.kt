package com.voicebot.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object ConfigStore {
    private const val PREFS_NAME = "voicebot_prefs"
    private const val KEY = "bot_config"

    fun save(context: Context, config: BotConfig) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY, config.toJson()).apply()
    }

    fun load(context: Context): BotConfig {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY, null) ?: return BotConfig()
        return try {
            BotConfig.fromJson(json)
        } catch (e: Exception) {
            BotConfig()
        }
    }

    fun loadActionsJson(context: Context): String {
        val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: BotConfig().toJson()
        return try {
            val obj = JSONObject(json)
            obj.getJSONArray("actions").toString(2)
        } catch (e: Exception) {
            "[]"
        }
    }

    fun saveActionsFromJson(context: Context, actionsJson: String) {
        val config = load(context)
        val arr = JSONArray(actionsJson)
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
        save(context, config.copy(actions = actions))
    }
}
