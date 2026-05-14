package io.github.blayalems.lift

import android.content.Context
import android.content.Intent
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat

/**
 * Exposed to the PWA as `window.LiftAndroid`.
 * Called from JavaScript on the main thread via WebView's JS bridge.
 */
class LiftBridge(private val context: Context) {

    /** Called every time the workout phase or set changes. */
    @JavascriptInterface
    fun onWorkoutState(json: String) {
        val intent = Intent(context, WorkoutService::class.java).apply {
            action = WorkoutService.ACTION_UPDATE
            putExtra(WorkoutService.EXTRA_SNAP, json)
        }
        ContextCompat.startForegroundService(context, intent)
    }

    /** Called when the workout ends or is cancelled. */
    @JavascriptInterface
    fun clearWorkout() {
        context.startService(
            Intent(context, WorkoutService::class.java).apply {
                action = WorkoutService.ACTION_CLEAR
            }
        )
    }

    /** Lets the PWA detect it is running inside the native wrapper. */
    @JavascriptInterface
    fun isNative(): Boolean = true
}
