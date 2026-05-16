package com.qwen.code.android;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * ZAIWebViewPlugin - Opens Z.ai in a full-screen native WebView with:
 * - Full cookie support (persists login sessions)
 * - JavaScript enabled
 * - DOM storage enabled
 * - Custom User-Agent to avoid blocks
 * - Close button to return to the app
 * - URL bar for navigation
 * - Back navigation support
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
    private boolean isWebViewOpen = false;

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
        if (isWebViewOpen) {
            // Just navigate to the new URL
            if (webView != null) {
                webView.loadUrl(url);
                updateUrlBar(url);
            }
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
        TextView closeBtn = createToolbarButton("✕", Color.parseColor("#f87171"), v -> {
            closeWebViewInternal();
        });
        toolbar.addView(closeBtn);

        // Back button
        TextView backBtn = createToolbarButton("←", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
            }
        });
        toolbar.addView(backBtn);

        // Forward button
        TextView forwardBtn = createToolbarButton("→", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null && webView.canGoForward()) {
                webView.goForward();
            }
        });
        toolbar.addView(forwardBtn);

        // Refresh button
        TextView refreshBtn = createToolbarButton("↻", Color.parseColor("#e8e8ff"), v -> {
            if (webView != null) {
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
        urlBar.setPadding(12, 8, 12, 8);
        urlBar.setBackgroundColor(Color.parseColor("#1a1a3e"));
        LinearLayout.LayoutParams urlParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        urlParams.setMargins(8, 0, 8, 0);
        urlBar.setLayoutParams(urlParams);
        toolbar.addView(urlBar);

        // Bookmark buttons
        TextView zaiChatBtn = createToolbarButton("🤖", Color.parseColor("#4a90d9"), v -> {
            webView.loadUrl("https://chat.z.ai");
            updateUrlBar("https://chat.z.ai");
        });
        toolbar.addView(zaiChatBtn);

        TextView apiKeyBtn = createToolbarButton("🔑", Color.parseColor("#4ade80"), v -> {
            webView.loadUrl("https://open.bigmodel.cn/usercenter/apikeys");
            updateUrlBar("https://open.bigmodel.cn/usercenter/apikeys");
        });
        toolbar.addView(apiKeyBtn);

        mainLayout.addView(toolbar);

        // === Progress Bar ===
        progressBar = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            6
        ));
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setBackgroundColor(Color.parseColor("#1a1a3e"));
        mainLayout.addView(progressBar);

        // === WebView ===
        webView = new WebView(activity);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1.0f
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
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
        );

        // Enable cookies
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // WebView client
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String urlStr = request.getUrl().toString();
                // Allow all URLs within the WebView
                view.loadUrl(urlStr);
                updateUrlBar(urlStr);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setProgress(100);
                updateUrlBar(url);
                
                // Flush cookies to persist them
                CookieManager.getInstance().flush();
            }
        });

        // WebChromeClient for progress and alerts
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress == 100) {
                    progressBar.setProgress(0); // Hide after completion
                }
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                // Handle JS alerts
                result.confirm();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                result.confirm();
                return true;
            }
        });

        mainLayout.addView(webView);
        webViewContainer.addView(mainLayout);

        // Add to activity root view
        ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        rootView.addView(webViewContainer, params);

        // Load URL
        webView.loadUrl(url);
        isWebViewOpen = true;

        // Keep screen on while browsing
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
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
        isWebViewOpen = false;

        // Clear screen on flag
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private TextView createToolbarButton(String text, int textColor, View.OnClickListener listener) {
        TextView btn = new TextView(getContext());
        btn.setText(text);
        btn.setTextColor(textColor);
        btn.setTextSize(18);
        btn.setPadding(12, 8, 12, 8);
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
