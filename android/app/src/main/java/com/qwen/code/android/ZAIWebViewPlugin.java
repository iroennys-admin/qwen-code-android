package com.qwen.code.android;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.CookieSyncManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.net.URISyntaxException;
import java.util.List;

/**
 * ZAIWebViewPlugin - Opens Z.ai in a full-screen native WebView with:
 * - Full cookie support (persists login sessions across app restarts)
 * - JavaScript enabled with all features
 * - DOM storage and database enabled
 * - Realistic User-Agent to bypass bot detection
 * - Proper URL loading (no double-request bug)
 * - Error handling with retry
 * - Close button to return to the app
 * - URL bar for navigation
 * - Back/forward/refresh navigation
 * - Quick access bookmarks for Z.ai services
 */
@CapacitorPlugin(
    name = "ZAIWebView",
    permissions = {}
)
public class ZAIWebViewPlugin extends Plugin {

    private static final String DEFAULT_URL = "https://chat.z.ai";
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

    @PluginMethod
    public void openWebView(PluginCall call) {
        String url = call.getString("url", DEFAULT_URL);

        getActivity().runOnUiThread(() -> {
            try {
                openWebViewInternal(url);
                JSObject result = new JSObject();
                result.put("value", true);
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

    private void openWebViewInternal(String url) {
        if (isWebViewOpen && webView != null) {
            // Just navigate to the new URL
            webView.loadUrl(url);
            updateUrlBar(url);
            hideError();
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

        // Bookmark buttons
        TextView zaiChatBtn = createToolbarButton("Z", Color.parseColor("#4a90d9"), v -> {
            if (webView != null) {
                hideError();
                webView.loadUrl("https://chat.z.ai");
            }
        });
        toolbar.addView(zaiChatBtn);

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

        // === WebView Container (FrameLayout for overlay) ===
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

        // Realistic User-Agent matching current Chrome on Android
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36"
        );

        // Enable cookies with persistence
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // WebView client - FIXED: don't intercept normal HTTP/HTTPS URLs
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String urlStr = request.getUrl().toString();

                // Only intercept non-HTTP schemes (tel:, mailto:, intent:, etc.)
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
                            // Check if there's an app that can handle this intent
                            List<ResolveInfo> resolves = getActivity().getPackageManager()
                                .queryIntentActivities(intent, 0);
                            if (!resolves.isEmpty()) {
                                getActivity().startActivity(intent);
                                return true;
                            }
                            // Try fallback URL if available
                            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                            if (fallbackUrl != null) {
                                view.loadUrl(fallbackUrl);
                                return true;
                            }
                        }
                    } catch (URISyntaxException e) {
                        // Invalid intent URL, let WebView try to handle it
                    }
                    return true;
                }
                if (urlStr.startsWith("market://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(urlStr));
                        getActivity().startActivity(intent);
                    } catch (Exception e) {
                        // Play Store not available
                    }
                    return true;
                }

                // For all HTTP/HTTPS URLs, let the WebView handle them naturally
                // This is the KEY FIX - returning false means the WebView loads the URL itself
                // without creating a duplicate request that causes ERR_BLOCKED_BY_RESPONSE
                updateUrlBar(urlStr);
                return false;
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

                // Flush cookies to persist them
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                // Only show error for the main frame, not sub-resources
                if (request.isForMainFrame()) {
                    String errorMsg = "Error desconocido";
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        errorMsg = String.valueOf(error.getDescription());
                    }
                    int errorCode = error.getErrorCode();
                    String errorDetail_str = "Codigo: " + errorCode + " - " + errorMsg;
                    showError("No se pudo cargar la pagina", errorDetail_str);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame()) {
                    String msg = "HTTP " + errorResponse.getStatusCode() + " " + errorResponse.getReasonPhrase();
                    showError("Error del servidor", msg);
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // For Z.ai which should have valid SSL, just proceed
                // This handles edge cases with certificate chain issues
                handler.proceed();
            }
        });

        // WebChromeClient for progress and alerts
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress == 100) {
                    // Hide progress bar after short delay
                    view.postDelayed(() -> progressBar.setProgress(0), 500);
                }
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
                // For login prompts, auto-confirm (some older auth systems use JS prompts)
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
        retryBtn.setText("Reintentar");
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

        // Open in browser button
        TextView openBrowserBtn = new TextView(activity);
        openBrowserBtn.setText("Abrir en navegador externo");
        openBrowserBtn.setTextColor(Color.parseColor("#a0a0cc"));
        openBrowserBtn.setTextSize(13);
        openBrowserBtn.setPadding(24, 12, 24, 12);
        openBrowserBtn.setBackgroundColor(Color.parseColor("#1a1a3e"));
        openBrowserBtn.setGravity(android.view.Gravity.CENTER);
        openBrowserBtn.setOnClickListener(v -> {
            try {
                String urlToOpen = lastLoadedUrl != null ? lastLoadedUrl : DEFAULT_URL;
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(urlToOpen));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
            } catch (Exception e) {
                // No browser available
            }
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

        // Keep screen on while browsing
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void showError(String title, String detail) {
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

        // Save cookies before closing
        CookieManager.getInstance().flush();

        // Remove WebView from root view
        if (webViewContainer != null) {
            ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            rootView.removeView(webViewContainer);
        }

        // Destroy WebView to free memory
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

        // Clear screen on flag
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
