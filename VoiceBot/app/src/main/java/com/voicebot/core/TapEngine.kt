package com.voicebot.core

import android.util.Log
import com.voicebot.data.BotConfig
import com.voicebot.data.TapAction
import kotlin.random.Random

object TapEngine {
    private const val TAG = "TapEngine"

    fun execute(config: BotConfig): Boolean {
        if (DegradationManager.shouldSkip()) {
            Log.w(TAG, "退化跳过本次执行")
            Thread.sleep(3000)
            return true
        }

        val method = config.useMethod
        for (action in config.actions) {
            Thread.sleep(action.delayAfterMs.toLong())

            val driftX = DegradationManager.jitter(config.jitterPixels)
            val driftY = DegradationManager.jitter(config.jitterPixels)
            val tx = action.x + driftX
            val ty = action.y + driftY

            val modifiedAction = if (action.type == TapAction.ActionType.HOLD && DegradationManager.holdScale() < 1.0f) {
                action.copy(holdMs = (action.holdMs * DegradationManager.holdScale()).toInt().coerceAtLeast(200))
            } else {
                action
            }

            when (method) {
                BotConfig.TapMethod.INPUT -> inputMethod(tx, ty, modifiedAction)
                BotConfig.TapMethod.SENDEVENT -> sendeventMethod(tx, ty, modifiedAction)
            }
            Log.d(TAG, "${action.label}: tap($tx,$ty) drift=($driftX,$driftY) level=${DegradationManager.level}")
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
