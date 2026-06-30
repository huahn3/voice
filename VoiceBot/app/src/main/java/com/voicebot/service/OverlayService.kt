package com.voicebot.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.voicebot.R

class OverlayService : Service() {
    private var overlayView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var startX = 0f
    private var startY = 0f

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.getBooleanExtra("hide", false) == true) {
            removeOverlay()
            return START_NOT_STICKY
        }
        showOverlay()
        return START_STICKY
    }

    private fun showOverlay() {
        if (overlayView != null) return
        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_calibrate, null)

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = 200
        }

        overlayView?.setOnTouchListener { v, event ->
            val coordText = v.findViewById<TextView>(R.id.coordText)
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = event.rawX
                    startY = event.rawY
                    coordText?.text = "(${event.rawX.toInt()}, ${event.rawY.toInt()})"
                }
                MotionEvent.ACTION_MOVE -> {
                    params?.let {
                        it.x = (event.rawX - startX).toInt()
                        it.y = (event.rawY - startY).toInt()
                        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
                        wm.updateViewLayout(v, it)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    coordText?.text = "位置: (${v.x.toInt()}, ${v.y.toInt()})"
                }
            }
            true
        }

        overlayView?.findViewById<View>(R.id.closeOverlay)?.setOnClickListener {
            stopSelf()
        }

        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        wm.addView(overlayView, params)

        val size = ShellSize(this)
        overlayView?.findViewById<TextView>(R.id.coordText)?.text =
            "屏幕: ${size.first}x${size.second} | 拖动到目标位置"
    }

    private fun removeOverlay() {
        overlayView?.let {
            try {
                (getSystemService(WINDOW_SERVICE) as WindowManager).removeView(it)
            } catch (_: Exception) {}
        }
        overlayView = null
    }

    override fun onDestroy() {
        removeOverlay()
        super.onDestroy()
    }

    private data class ShellSize(val c: Context) {
        val first: Int get() = c.resources.displayMetrics.widthPixels
        val second: Int get() = c.resources.displayMetrics.heightPixels
    }
}
