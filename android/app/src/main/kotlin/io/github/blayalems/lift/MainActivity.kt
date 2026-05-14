package io.github.blayalems.lift

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_NOTIF_ACTION = "notif_action"
        private const val PWA_URL = "https://blayalems.github.io/lift/"
    }

    private lateinit var webView: WebView

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goFullscreen()
        requestNotificationPermission()

        webView = WebView(this).also { wv ->
            wv.settings.apply {
                javaScriptEnabled    = true
                domStorageEnabled    = true
                databaseEnabled      = true
                cacheMode            = WebSettings.LOAD_DEFAULT
                allowFileAccess      = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode     = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            wv.webChromeClient = LiftChromeClient()
            wv.webViewClient   = LiftWebViewClient()
            wv.addJavascriptInterface(LiftBridge(this), "LiftAndroid")
            setContentView(wv)
        }

        webView.loadUrl(PWA_URL)

        // Handle shortcut / notification action passed at cold start
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onResume()  { super.onResume();  webView.onResume()  }
    override fun onPause()   { super.onPause();   webView.onPause()   }
    override fun onDestroy() { super.onDestroy(); webView.destroy()   }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    // ── Intent handling ────────────────────────────────────────────────────────

    private fun handleIntent(intent: Intent?) {
        val action = intent?.getStringExtra(EXTRA_NOTIF_ACTION) ?: return
        // Dispatch the notification action into the PWA
        val safe = action.replace("'", "\\'")
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('liftNativeAction',{detail:'$safe'}));",
                null
            )
        }
        // Clear so repeated onNewIntent calls don't re-fire
        intent.removeExtra(EXTRA_NOTIF_ACTION)
    }

    // ── Fullscreen / edge-to-edge ──────────────────────────────────────────────

    private fun goFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    // ── Notification permission (Android 13+) ─────────────────────────────────

    private val notifPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* no-op — user chose; service will handle gracefully */ }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    // ── WebView clients ────────────────────────────────────────────────────────

    private inner class LiftWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            // Keep all navigation inside the WebView
            return false
        }

        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            injectNativeBridgeHook()
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            // Reject — never accept invalid certs
            handler.cancel()
        }
    }

    private inner class LiftChromeClient : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            // Allow camera / microphone only if the PWA origin requests them
            if (request.origin.toString().startsWith("https://blayalems.github.io")) {
                request.grant(request.resources)
            } else {
                request.deny()
            }
        }
    }

    /**
     * Inject a small shim that:
     * 1. Marks the runtime as native so the PWA can detect it.
     * 2. Listens for liftNativeAction events (dispatched by handleIntent) and
     *    routes them to the PWA's internal notification action handler.
     */
    private fun injectNativeBridgeHook() {
        val js = """
            (function() {
                if (window.__liftNativeHooked) return;
                window.__liftNativeHooked = true;

                window.LIFT_IS_NATIVE = true;

                window.addEventListener('liftNativeAction', function(e) {
                    var action = e.detail;
                    if (!action) return;
                    // Route into the PWA's existing cold-notification handler
                    var url = new URL(location.href);
                    url.searchParams.set('notifAction', action);
                    history.replaceState(null, '', url.toString());
                    window.dispatchEvent(new Event('liftHandleColdAction'));
                });

                console.log('[Lift] Native bridge active.');
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }
}
