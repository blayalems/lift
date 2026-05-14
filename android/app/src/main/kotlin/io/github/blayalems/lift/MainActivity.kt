package io.github.blayalems.lift

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_NOTIF_ACTION = "notif_action"
        private const val PWA_URL = "https://blayalems.github.io/lift/"
    }

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goFullscreen()
        requestNotifPermissionIfNeeded()

        webView = WebView(this).also { wv ->
            wv.settings.apply {
                javaScriptEnabled            = true
                domStorageEnabled            = true
                databaseEnabled              = true
                cacheMode                    = WebSettings.LOAD_DEFAULT
                allowFileAccess              = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode             = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            wv.webChromeClient = LiftChromeClient()
            wv.webViewClient   = LiftWebViewClient()
            wv.addJavascriptInterface(LiftBridge(this), "LiftAndroid")
            setContentView(wv)
        }

        webView.loadUrl(PWA_URL)
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

    @Deprecated("Deprecated in API 33")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    // ── Intent handling ────────────────────────────────────────────────────────

    private fun handleIntent(intent: Intent?) {
        val action = intent?.getStringExtra(EXTRA_NOTIF_ACTION) ?: return
        val safe = action.replace("'", "\\'")
        webView.post {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('liftNativeAction',{detail:'$safe'}));",
                null
            )
        }
        intent.removeExtra(EXTRA_NOTIF_ACTION)
    }

    // ── Fullscreen ─────────────────────────────────────────────────────────────

    private fun goFullscreen() {
        val flags = (android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = flags
    }

    // ── Notification permission ────────────────────────────────────────────────

    private fun requestNotifPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    // ── WebView clients ────────────────────────────────────────────────────────

    private inner class LiftWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = false

        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            view.evaluateJavascript("""
                (function(){
                    if(window.__liftNativeHooked)return;
                    window.__liftNativeHooked=true;
                    window.LIFT_IS_NATIVE=true;
                    window.addEventListener('liftNativeAction',function(e){
                        var a=e.detail;if(!a)return;
                        var u=new URL(location.href);
                        u.searchParams.set('notifAction',a);
                        history.replaceState(null,'',u.toString());
                        window.dispatchEvent(new Event('liftHandleColdAction'));
                    });
                })();
            """.trimIndent(), null)
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
        }
    }

    private inner class LiftChromeClient : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            if (request.origin.toString().startsWith("https://blayalems.github.io")) {
                request.grant(request.resources)
            } else {
                request.deny()
            }
        }
    }
}
