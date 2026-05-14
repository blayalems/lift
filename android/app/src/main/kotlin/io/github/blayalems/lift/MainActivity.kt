package io.github.blayalems.lift

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_NOTIF_ACTION = "notif_action"
        private const val PWA_URL = "https://blayalems.github.io/lift/"
        private const val NOTIF_PERM_REQUEST = 1
        private const val PREFS_NAME = "lift"
        private const val PREFS_KEY_VC = "vc"
    }

    private lateinit var webView: WebView
    private var pendingAction: String? = null
    private var pendingAssetRefreshVersion: Int = 0

    // File chooser callback held while the system picker is open
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris: Array<Uri>? = if (result.resultCode == RESULT_OK) {
            val data = result.data
            when {
                data?.clipData != null ->
                    Array(data.clipData!!.itemCount) { data.clipData!!.getItemAt(it).uri }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goFullscreen()
        requestNotifPermissionIfNeeded()

        webView = WebView(this).also { wv ->
            wv.settings.apply {
                javaScriptEnabled                = true
                domStorageEnabled                = true
                databaseEnabled                  = true
                cacheMode                        = WebSettings.LOAD_DEFAULT
                allowFileAccess                  = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode                 = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                builtInZoomControls              = false
                displayZoomControls              = false
                setSupportZoom(false)
            }
            wv.isVerticalScrollBarEnabled   = false
            wv.isHorizontalScrollBarEnabled = false
            wv.webChromeClient = LiftChromeClient()
            wv.webViewClient   = LiftWebViewClient()
            wv.addJavascriptInterface(LiftBridge(this), "LiftAndroid")
            setContentView(wv)
        }

        // Buffer any cold-start notification action; flushed in onPageFinished after
        // the JS listener is installed — dispatching here would race the page load.
        pendingAction = intent?.getStringExtra(EXTRA_NOTIF_ACTION)
        intent?.removeExtra(EXTRA_NOTIF_ACTION)

        val initialUrl = prepareUrlForVersion()
        webView.loadUrl(initialUrl)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val action = intent.getStringExtra(EXTRA_NOTIF_ACTION) ?: return
        intent.removeExtra(EXTRA_NOTIF_ACTION)
        if (pendingAssetRefreshVersion > 0 || !::webView.isInitialized) {
            pendingAction = action
            return
        }
        dispatchAction(action)
    }

    // Re-apply fullscreen after the user transiently reveals system bars
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goFullscreen()
    }

    override fun onResume()  { super.onResume();  webView.onResume()  }
    override fun onPause()   { super.onPause();   webView.onPause()   }
    override fun onDestroy() { super.onDestroy(); webView.destroy()   }

    @Deprecated("Deprecated in API 33")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    // ── Action dispatch ────────────────────────────────────────────────────────

    private fun dispatchAction(action: String) {
        val safe = JSONObject.quote(action)
        webView.post {
            webView.evaluateJavascript(
                "if(window.__liftDispatchNativeAction){window.__liftDispatchNativeAction($safe);}else{window.dispatchEvent(new CustomEvent('liftNativeAction',{detail:$safe}));}",
                null
            )
        }
    }

    // ── PWA cache invalidation on APK version change ───────────────────────────

    private fun prepareUrlForVersion(): String {
        val prefs   = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val stored  = prefs.getInt(PREFS_KEY_VC, 0)
        val current = currentVersionCode()
        if (stored != current) {
            webView.clearCache(true)
            webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
            pendingAssetRefreshVersion = current
            return Uri.parse(PWA_URL).buildUpon()
                .appendQueryParameter("nativeVersion", current.toString())
                .appendQueryParameter("cacheBust", System.currentTimeMillis().toString())
                .build()
                .toString()
        }
        return PWA_URL
    }

    private fun currentVersionCode(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageManager.getPackageInfo(packageName, 0).longVersionCode.toInt()
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(packageName, 0).versionCode
        }

    // ── Fullscreen ─────────────────────────────────────────────────────────────

    private fun goFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    // ── Notification permission ────────────────────────────────────────────────

    private fun requestNotifPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIF_PERM_REQUEST)
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
                    window.__liftPendingNativeActions=window.__liftPendingNativeActions||[];
                    window.__liftDispatchNativeAction=function(a){
                        if(!a)return;
                        if(!window.__liftNativeActionReady){
                            window.__liftPendingNativeActions.push(String(a));
                        }
                        window.dispatchEvent(new CustomEvent('liftNativeAction',{detail:String(a)}));
                    };
                })();
            """.trimIndent(), null)

            if (pendingAssetRefreshVersion > 0) {
                refreshPwaAssetsAfterApkUpdate(view, pendingAssetRefreshVersion)
                return
            }

            // Flush any cold-start action buffered before this listener existed
            pendingAction?.let { action ->
                pendingAction = null
                dispatchAction(action)
            }
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

        override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            // Cancel any previous callback that never resolved
            this@MainActivity.filePathCallback?.onReceiveValue(null)
            this@MainActivity.filePathCallback = filePathCallback
            return try {
                fileChooserLauncher.launch(fileChooserParams.createIntent())
                true
            } catch (e: Exception) {
                this@MainActivity.filePathCallback = null
                false
            }
        }
    }

    private fun refreshPwaAssetsAfterApkUpdate(view: WebView, versionCode: Int) {
        pendingAssetRefreshVersion = 0
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putInt(PREFS_KEY_VC, versionCode)
            .apply()

        val freshUrl = Uri.parse(PWA_URL).buildUpon()
            .appendQueryParameter("nativeVersion", versionCode.toString())
            .appendQueryParameter("assetRefresh", System.currentTimeMillis().toString())
            .build()
            .toString()
        val safeUrl = JSONObject.quote(freshUrl)
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT
        view.evaluateJavascript("""
            (function(){
                var clearCaches = window.caches ? caches.keys().then(function(keys){
                    return Promise.all(keys.filter(function(key){
                        return key.indexOf('lift-') === 0;
                    }).map(function(key){ return caches.delete(key); }));
                }) : Promise.resolve();
                var unregister = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function(regs){
                    return Promise.all(regs.map(function(reg){ return reg.unregister(); }));
                }) : Promise.resolve();
                Promise.all([clearCaches, unregister]).catch(function(){}).then(function(){
                    location.replace($safeUrl);
                });
            })();
        """.trimIndent(), null)
    }
}
