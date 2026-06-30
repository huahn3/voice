package com.voicebot.core

import android.util.Log
import com.voicebot.data.BotConfig
import com.voicebot.data.TapAction
import kotlin.random.Random

object TapEngine {
    private const val TAG = "TapEngine"

    fun execute(config: BotConfig): Boolean {
        val method = config.useMethod
        for (action in config.actions) {
            Thread.sleep(action.delayAfterMs.toLong())
            val (tx, ty) = if (config.randomizeTaps && config.jitterPixels > 0) {
                val jx = (Random.nextInt(config.jitterPixels * 2 + 1) - config.jitterPixels)
                val jy = (Random.nextInt(config.jitterPixels * 2 + 1) - config.jitterPixels)
                Pair(action.x + jx, action.y + jy)
            } else {
                Pair(action.x, action.y)
            }
            when (method) {
                BotConfig.TapMethod.INPUT -> inputMethod(tx, ty, action)
                BotConfig.TapMethod.SENDEVENT -> sendeventMethod(tx, ty, action)
            }
            Log.d(TAG, "${action.label}: tap($tx,$ty) type=${action.type}")
        }
        return true
    }

    private fun inputMethod(x: Int, y: Int, action: TapAction) {
        when (action.type) {
            TapAction.ActionType.TAP -> Shell.exec("input tap $x $y")
            TapAction.ActionType.HOLD -> Shell.exec("input swipe $x $y $x $y ${action.holdMs}")
            TapAction.ActionType.SWIPE_UP -> Shell.exec("input swipe $x $y $x ${y - 300} 200")
            TapAction.ActionType.SWIPE_DOWN -> Shell.exec("input swipe $x $y $x ${y + 300} 200")
        }
    }

    private fun sendeventMethod(x: Int, y: Int, action: TapAction) {
        val dev = Shell.getTouchDevice() ?: run {
            inputMethod(x, y, action)
            return
        }
        val cmds = buildList {
            add("sendevent $dev 3 47 0")
            add("sendevent $dev 3 53 $x")
            add("sendevent $dev 3 54 $y")
            add("sendevent $dev 3 58 $x")
            add("sendevent $dev 0 2 0")
            add("sendevent $dev 0 0 0")
            if (action.type == TapAction.ActionType.HOLD && action.holdMs > 0) {
                add("usleep ${action.holdMs * 1000}")
            } else {
                add("usleep 80000")
            }
            add("sendevent $dev 3 47 1")
            add("sendevent $dev 0 2 0")
            add("sendevent $dev 0 0 0")
        }
        Shell.exec(cmds.joinToString(" && "))
    }

    fun testRoot(): Boolean {
        val result = Shell.exec("id")
        return result.success && result.stdout.contains("uid=0")
    }
}
