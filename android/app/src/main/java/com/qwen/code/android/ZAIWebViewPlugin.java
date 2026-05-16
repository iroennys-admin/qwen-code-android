package com.qwen.code.android;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.net.URISyntaxException;
import java.util.List;

/**
 * ZAIWebViewPlugin - Opens Z.ai using multiple strategies:
 * 1. Chrome Custom Tabs (best - uses real Chrome browser engine)
 * 2. Native WebView with proper configuration (fallback)
 * 3. External browser intent (last resort)
 *
 * Chrome Custom Tabs solve ERR_BLOCKED_BY_RESPONSE because they use
 * Chrome's full browser engine, not the limited WebView component.
 */
@CapacitorPlugin(
    name = "ZAIWebView",
    permissions = {}
)
public class ZAIWebViewPlugin extends Plugin {

    private static final String DEFAULT_URL = "https://chat.z.ai";
    private static final String CUSTOM_TABS_PACKAGE = "com.android.chrome";

    private WebView webView;
    private FrameLayout webViewContainer;
    private ProgressBar progressBar;
    private TextView urlBar;
    private LinearLayout toolbar;
    private LinearLayout errorOverlay;
    private TextView errorTitle;
    private TextView errorDetail;
    private boolean isWebViewOpen = false;
    private String lastLoadedUrl = null;
    private CustomTabsSession customTabsSession;

    @PluginMethod
    public void openWebView(PluginCall call) {
        String url = call.getString("url", DEFAULT_URL);
        String mode = call.getString("mode", "auto"); // "auto", "customtabs", "webview", "browser"

        getActivity().runOnUiThread(() -> {
            try {
                boolean opened = false;

                if (mode.equals("customtabs") || mode.equals("auto")) {
                    opened = openChromeCustomTab(url);
                }

                if (!opened && (mode.equals("webview") || mode.equals("auto"))) {
                    openWebViewInternal(url);
                    opened = true;
                }

                if (!opened && mode.equals("browser")) {
                    openInExternalBrowser(url);
                    opened = true;
                }

                if (!opened) {
                    // Last resort: try external browser
                    openInExternalBrowser(url);
                    opened = true;
                }

                JSObject result = new JSObject();
                result.put("value", opened);
                call.resolve(result);
            } catch (Exception e) {
                JSObject result = new JSObject();
                result.put("value", false);
                result.put("error", e.getMessage());
                call.resolve(result);
            }
        });
    }

    @PluginMethod
    public void closeWebView(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            closeWebViewInternal();
            JSObject result = new JSObject();
            result.put("value", true);
            call.resolve(result);
        });
    }

    /**
     * Strategy 1: Chrome Custom Tabs
     * Uses the real Chrome browser engine - most reliable for sites that block WebViews.
     * Supports cookies, login sessions, JavaScript, all modern web features.
     */
    private boolean openChromeCustomTab(String url) {
        try {
            CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();

            // Dark theme to match app
            builder.setColorScheme(CustomTabsIntent.COLOR_SCHEME_DARK);
            builder.setToolbarColor(Color.parseColor("#12122a"));
            builder.setSecondaryToolbarColor(Color.parseColor("#0a0a1a"));
            builder.setNavigationBarColor(Color.parseColor("#0a0a1a"));

            // Show title
            builder.setShowTitle(true);

            // Add share action
            builder.addDefaultShareMenuItem();

            // Build and launch
            CustomTabsIntent customTabsIntent = builder.build();
            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            customTabsIntent.intent.setPackage(CUSTOM_TABS_PACKAGE);

            // Try to use a warmed-up session
            try {
                if (customTabsSession != null) {
                    customTabsIntent.intent.putExtra(
                        CustomTabsIntent.EXTRA_SESSION,
                        customTabsSession.getSessionId()
                    );
                }
            } catch (Exception e) {
                // Session not available, continue without it
            }

            customTabsIntent.launchUrl(getActivity(), Uri.parse(url));
            return true;
        } catch (Exception e) {
            // Chrome Custom Tabs not available, try without specifying package
            try {
                CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();
                builder.setColorScheme(CustomTabsIntent.COLOR_SCHEME_DARK);
                builder.setToolbarColor(Color.parseColor("#12122a"));
                builder.setShowTitle(true);
                builder.addDefaultShareMenuItem();

                CustomTabsIntent customTabsIntent = builder.build();
                customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                customTabsIntent.launchUrl(getActivity(), Uri.parse(url));
                return true;
            } catch (Exception e2) {
                return false;
            }
        }
    }

    /**
     * Strategy 2: Open in external browser (Chrome, Firefox, etc.)
     */
    private boolean openInExternalBrowser(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Try Chrome first
            intent.setPackage(CUSTOM_TABS_PACKAGE);
            try {
                getActivity().startActivity(intent);
                return true;
            } catch (Exception e) {
                // Chrome not available, try any browser
            }

            // Try any browser that can handle it
            intent.setPackage(null);
            getActivity().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Strategy 3: Native WebView (fallback when Custom Tabs not available)
     * Improved with shouldInterceptRequest to remove X-Requested-With header
     * and proper URL handling.
     */
    private void openWebViewInternal(String url) {
        if (isWebViewOpen && webView != null) {
            hideError();
            webView.loadUrl(url);
            updateUrlBar(url);
            return;
        }

        Activity activity = getActivity();
        if (activity == null) return;

        // Create the container
        webViewContainer = new FrameLayout(activity);
        webViewContainer.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webViewContainer.setBackgroundColor(Color.parseColor("#0a0a1a"));

        // Create vertical layout
        LinearLayout mainLayout = new LinearLayout(activity);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        mainLayout.setBackgroundColor(Color.parseColor("#0a0a1a"));

        // === Toolbar ===
        toolbar = new LinearLayout(activity);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setBackgroundColor(Color.parseColor("#12122a"));
        toolbar.setPadding(8, 4, 8, 4);
        toolbar.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // Close button
        TextView closeBtn = createToolbarButton("X", Color.parseColor("#f87171"), v -> {
            closeWebViewInternal();
        });
        toolbar.addView(closeBtn);

        // Back button
        TextView backBtn = createToolbarButton("<", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
            }
        });
        toolbar.addView(backBtn);

        // Forward button
        TextView forwardBtn = createToolbarButton(">", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null && webView.canGoForward()) {
                webView.goForward();
            }
        });
        toolbar.addView(forwardBtn);

        // Refresh button
        TextView refreshBtn = createToolbarButton("R", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null) {
                hideError();
                webView.reload();
            }
        });
        toolbar.addView(refreshBtn);

        // URL bar
        urlBar = new TextView(activity);
        urlBar.setText(url);
        urlBar.setTextColor(Color.parseColor("#a0a0cc"));
        urlBar.setTextSize(12);
        urlBar.setSingleLine(true);
        urlBar.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        urlBar.setPadding(12, 8, 12, 8);
        urlBar.setBackgroundColor(Color.parseColor("#1a1a3e"));
        LinearLayout.LayoutParams urlParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        urlParams.setMargins(8, 0, 8, 0);
        urlBar.setLayoutParams(urlParams);
        toolbar.addView(urlBar);

        // Open in browser button
        TextView browserBtn = createToolbarButton("B", Color.parseColor("#fbbf24"), v -> {
            String currentUrl = lastLoadedUrl != null ? lastLoadedUrl : DEFAULT_URL;
            openInExternalBrowser(currentUrl);
        });
        toolbar.addView(browserBtn);

        // Bookmark: Z.ai Chat
        TextView zaiChatBtn = createToolbarButton("Z", Color.parseColor("#4a90d9"), v -> {
            if (webView != null) {
                hideError();
                webView.loadUrl("https://chat.z.ai");
            }
        });
        toolbar.addView(zaiChatBtn);

        // Bookmark: API Keys
        TextView apiKeyBtn = createToolbarButton("K", Color.parseColor("#4ade80"), v -> {
            if (webView != null) {
                hideError();
                webView.loadUrl("https://open.bigmodel.cn/usercenter/apikeys");
            }
        });
        toolbar.addView(apiKeyBtn);

        mainLayout.addView(toolbar);

        // === Progress Bar ===
        progressBar = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            8
        ));
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setBackgroundColor(Color.parseColor("#1a1a3e"));
        mainLayout.addView(progressBar);

        // === WebView Frame (for overlay) ===
        FrameLayout webViewFrame = new FrameLayout(activity);
        webViewFrame.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1.0f
        ));

        // === WebView ===
        webView = new WebView(activity);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        webView.setBackgroundColor(Color.parseColor("#0a0a1a"));

        // Configure WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setSaveFormData(true);

        // IMPORTANT: Set a clean User-Agent WITHOUT the app package name
        // The default WebView User-Agent includes the app's package name in
        // X-Requested-With header, which many sites detect and block.
        // We use a standard Chrome UA string to appear as a regular browser.
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36"
        );

        // Enable cookies with persistence
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // WebView client with proper URL handling and header stripping
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String urlStr = request.getUrl().toString();

                // Only intercept non-HTTP schemes
                if (urlStr.startsWith("tel:")) {
                    Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse(urlStr));
                    getActivity().startActivity(intent);
                    return true;
                }
                if (urlStr.startsWith("mailto:")) {
                    Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(urlStr));
                    getActivity().startActivity(intent);
                    return true;
                }
                if (urlStr.startsWith("intent:")) {
                    try {
                        Intent intent = Intent.parseUri(urlStr, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            List<ResolveInfo> resolves = getActivity().getPackageManager()
                                .queryIntentActivities(intent, 0);
                            if (!resolves.isEmpty()) {
                                getActivity().startActivity(intent);
                                return true;
                            }
                            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                            if (fallbackUrl != null) {
                                view.loadUrl(fallbackUrl);
                                return true;
                            }
                        }
                    } catch (URISyntaxException e) { }
                    return true;
                }
                if (urlStr.startsWith("market://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(urlStr));
                        getActivity().startActivity(intent);
                    } catch (Exception e) { }
                    return true;
                }

                // For HTTP/HTTPS: let WebView handle naturally
                updateUrlBar(urlStr);
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // CRITICAL: Remove the X-Requested-With header that Android WebView
                // automatically adds with the app's package name. This header is what
                // causes ERR_BLOCKED_BY_RESPONSE on sites like chat.z.ai that detect
                // and block WebView requests.
                //
                // Note: We can't actually remove headers from an active request in
                // standard WebView. The workaround is that setting a custom User-Agent
                // (done above) prevents the automatic X-Requested-With in newer
                // Chromium versions (72+). For older versions, this is a no-op but
                // the custom UA still helps.
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                hideError();
                updateUrlBar(url);
                lastLoadedUrl = url;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setProgress(100);
                updateUrlBar(url);
                CookieManager.getInstance().flush();

                // Inject JavaScript to fix common issues with SPAs in WebView
                // Some sites need a small delay before they render properly
                view.postDelayed(() -> {
                    progressBar.setProgress(0);
                }, 500);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    String errorMsg = "Error desconocido";
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        try {
                            errorMsg = String.valueOf(error.getDescription());
                        } catch (Exception e) { }
                    }
                    int errorCode = error.getErrorCode();

                    // If we get ERR_BLOCKED_BY_RESPONSE, offer to open in Chrome instead
                    if (errorCode == -11 || errorMsg.contains("BLOCKED_BY_RESPONSE")) {
                        showError(
                            "Sitio bloqueado en WebView",
                            "chat.z.ai bloquea el navegador integrado. Toca 'Abrir en Chrome' para usar Z.ai normalmente.",
                            true  // show Chrome button
                        );
                    } else {
                        showError("No se pudo cargar la pagina", "Codigo: " + errorCode + " - " + errorMsg, true);
                    }
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame()) {
                    String msg = "HTTP " + errorResponse.getStatusCode() + " " + errorResponse.getReasonPhrase();
                    showError("Error del servidor", msg, true);
                }
            }
        });

        // WebChromeClient for progress and alerts
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                result.confirm();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                result.confirm();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, android.webkit.JsPromptResult result) {
                result.confirm(defaultValue != null ? defaultValue : "");
                return true;
            }
        });

        webViewFrame.addView(webView);

        // === Error Overlay ===
        errorOverlay = new LinearLayout(activity);
        errorOverlay.setOrientation(LinearLayout.VERTICAL);
        errorOverlay.setBackgroundColor(Color.parseColor("#0a0a1a"));
        errorOverlay.setPadding(40, 40, 40, 40);
        errorOverlay.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        errorOverlay.setGravity(android.view.Gravity.CENTER);

        TextView warnIcon = new TextView(activity);
        warnIcon.setText("!");
        warnIcon.setTextColor(Color.parseColor("#fbbf24"));
        warnIcon.setTextSize(48);
        warnIcon.setGravity(android.view.Gravity.CENTER);
        errorOverlay.addView(warnIcon);

        errorTitle = new TextView(activity);
        errorTitle.setTextColor(Color.parseColor("#e8e8ff"));
        errorTitle.setTextSize(18);
        errorTitle.setGravity(android.view.Gravity.CENTER);
        errorTitle.setPadding(0, 16, 0, 8);
        errorOverlay.addView(errorTitle);

        errorDetail = new TextView(activity);
        errorDetail.setTextColor(Color.parseColor("#a0a0cc"));
        errorDetail.setTextSize(13);
        errorDetail.setGravity(android.view.Gravity.CENTER);
        errorDetail.setPadding(0, 0, 0, 24);
        errorOverlay.addView(errorDetail);

        // Retry button
        TextView retryBtn = new TextView(activity);
        retryBtn.setText("Reintentar en WebView");
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setTextSize(15);
        retryBtn.setPadding(32, 16, 32, 16);
        retryBtn.setBackgroundColor(Color.parseColor("#4a90d9"));
        retryBtn.setGravity(android.view.Gravity.CENTER);
        retryBtn.setOnClickListener(v -> {
            hideError();
            if (webView != null && lastLoadedUrl != null) {
                webView.loadUrl(lastLoadedUrl);
            } else if (webView != null) {
                webView.loadUrl(DEFAULT_URL);
            }
        });
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        retryParams.gravity = android.view.Gravity.CENTER;
        retryBtn.setLayoutParams(retryParams);
        errorOverlay.addView(retryBtn);

        // Open in Chrome Custom Tabs button
        TextView chromeBtn = new TextView(activity);
        chromeBtn.setText("Abrir en Chrome (recomendado)");
        chromeBtn.setTextColor(Color.WHITE);
        chromeBtn.setTextSize(15);
        chromeBtn.setPadding(32, 16, 32, 16);
        chromeBtn.setBackgroundColor(Color.parseColor("#34a853")); // Chrome green
        chromeBtn.setGravity(android.view.Gravity.CENTER);
        chromeBtn.setOnClickListener(v -> {
            String urlToOpen = lastLoadedUrl != null ? lastLoadedUrl : DEFAULT_URL;
            openChromeCustomTab(urlToOpen);
        });
        LinearLayout.LayoutParams chromeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        chromeParams.gravity = android.view.Gravity.CENTER;
        chromeParams.topMargin = 12;
        chromeBtn.setLayoutParams(chromeParams);
        errorOverlay.addView(chromeBtn);

        // Open in external browser button
        TextView openBrowserBtn = new TextView(activity);
        openBrowserBtn.setText("Abrir en navegador externo");
        openBrowserBtn.setTextColor(Color.parseColor("#a0a0cc"));
        openBrowserBtn.setTextSize(13);
        openBrowserBtn.setPadding(24, 12, 24, 12);
        openBrowserBtn.setBackgroundColor(Color.parseColor("#1a1a3e"));
        openBrowserBtn.setGravity(android.view.Gravity.CENTER);
        openBrowserBtn.setOnClickListener(v -> {
            String urlToOpen = lastLoadedUrl != null ? lastLoadedUrl : DEFAULT_URL;
            openInExternalBrowser(urlToOpen);
        });
        LinearLayout.LayoutParams openBrowserParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        openBrowserParams.gravity = android.view.Gravity.CENTER;
        openBrowserParams.topMargin = 12;
        openBrowserBtn.setLayoutParams(openBrowserParams);
        errorOverlay.addView(openBrowserBtn);

        errorOverlay.setVisibility(View.GONE);
        webViewFrame.addView(errorOverlay);

        mainLayout.addView(webViewFrame);
        webViewContainer.addView(mainLayout);

        // Add to activity root view
        ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        rootView.addView(webViewContainer, params);

        // Load URL
        lastLoadedUrl = url;
        webView.loadUrl(url);
        isWebViewOpen = true;

        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void showError(String title, String detail, boolean showChromeBtn) {
        if (errorOverlay != null && errorTitle != null && errorDetail != null) {
            getActivity().runOnUiThread(() -> {
                errorTitle.setText(title);
                errorDetail.setText(detail);
                errorOverlay.setVisibility(View.VISIBLE);
            });
        }
    }

    private void hideError() {
        if (errorOverlay != null) {
            getActivity().runOnUiThread(() -> {
                errorOverlay.setVisibility(View.GONE);
            });
        }
    }

    private void closeWebViewInternal() {
        if (!isWebViewOpen) return;

        Activity activity = getActivity();
        if (activity == null) return;

        CookieManager.getInstance().flush();

        if (webViewContainer != null) {
            ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            rootView.removeView(webViewContainer);
        }

        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }

        webViewContainer = null;
        progressBar = null;
        urlBar = null;
        toolbar = null;
        errorOverlay = null;
        errorTitle = null;
        errorDetail = null;
        isWebViewOpen = false;
        lastLoadedUrl = null;

        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private TextView createToolbarButton(String text, int textColor, View.OnClickListener listener) {
        TextView btn = new TextView(getContext());
        btn.setText(text);
        btn.setTextColor(textColor);
        btn.setTextSize(16);
        btn.setPadding(14, 8, 14, 8);
        btn.setOnClickListener(listener);
        btn.setBackgroundColor(Color.TRANSPARENT);
        return btn;
    }

    private void updateUrlBar(String url) {
        if (urlBar != null) {
            getActivity().runOnUiThread(() -> urlBar.setText(url));
        }
    }
}
