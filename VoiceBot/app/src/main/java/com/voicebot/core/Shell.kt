package com.voicebot.core

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader

object Shell {
    private const val TAG = "Shell"
    private var suAvailable: Boolean? = null

    fun hasRoot(): Boolean {
        if (suAvailable != null) return suAvailable!!
        suAvailable = try {
            // Method 1: check if su binary exists
            val whichProc = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val path = BufferedReader(InputStreamReader(whichProc.inputStream)).readLine()
            whichProc.waitFor()
            if (path.isNullOrBlank()) {
                false
            } else {
                // Method 2: try to actually run su
                val testResult = exec("id", asRoot = true)
                testResult.success && testResult.stdout.contains("uid=0")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Root check failed", e)
            false
        }
        return suAvailable!!
    }

    fun exec(command: String, asRoot: Boolean = true): ShellResult {
        return try {
            val cmd = if (asRoot) arrayOf("su", "-c", command) else arrayOf("sh", "-c", command)
            val proc = Runtime.getRuntime().exec(cmd)
            val stdout = BufferedReader(InputStreamReader(proc.inputStream)).readText().trim()
            val stderr = BufferedReader(InputStreamReader(proc.errorStream)).readText().trim()
            val exitCode = proc.waitFor()
            ShellResult(exitCode == 0, stdout, stderr)
        } catch (e: Exception) {
            Log.e(TAG, "exec failed: $command", e)
            ShellResult(false, "", e.message ?: "unknown error")
        }
    }

    fun requestRoot(): Boolean {
        suAvailable = null
        return hasRoot()
    }

    fun getScreenSize(): Pair<Int, Int>? {
        val result = exec("wm size", asRoot = false)
        if (result.success) {
            val match = Regex("(\\d+)x(\\d+)").find(result.stdout)
            if (match != null) {
                return Pair(match.groupValues[1].toInt(), match.groupValues[2].toInt())
            }
        }
        return null
    }

    fun getTouchDevice(): String? {
        val result = exec("getevent -p 2>/dev/null | grep -B1 'ABS_MT_POSITION' | grep -o '/dev/input/event[0-9]*' | head -1")
        if (result.success && result.stdout.isNotBlank()) {
            return result.stdout.lines().first().trim()
        }
        return null
    }
}

data class ShellResult(val success: Boolean, val stdout: String, val stderr: String)
