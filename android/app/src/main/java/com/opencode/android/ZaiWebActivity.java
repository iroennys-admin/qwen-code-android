package com.opencode.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Full-screen native WebView for chat.z.ai (or any URL).
 *  - Persistent cookies via CookieManager
 *  - Toolbar: back / forward / home / reload / URL bar / open external / close
 *  - No iframe X-Frame-Options restriction (we are the top-level WebView)
 *  - Microphone/camera auto-grant for in-app dialog
 *  - Downloads delegated to system browser
 */
public class ZaiWebActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";

    private static final String MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

    private WebView web;
    private ProgressBar progress;
    private TextView urlBar;
    private Button backBtn, forwardBtn, reloadBtn, homeBtn, externalBtn, closeBtn;
    private String homeUrl = "https://chat.z.ai";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.parseColor("#06070d"));

        Intent intent = getIntent();
        if (intent != null && intent.getStringExtra(EXTRA_URL) != null) {
            homeUrl = intent.getStringExtra(EXTRA_URL);
        }

        // Root vertical layout
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#06070d"));
        root.setFitsSystemWindows(true);

        // Top toolbar
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setBackgroundColor(Color.parseColor("#0c0f1a"));
        bar.setPadding(dp(4), dp(6), dp(4), dp(6));
        bar.setGravity(Gravity.CENTER_VERTICAL);

        backBtn = barBtn("‹");
        forwardBtn = barBtn("›");
        homeBtn = barBtn("⌂");
        reloadBtn = barBtn("⟳");
        externalBtn = barBtn("↗");
        closeBtn = barBtn("✕");

        urlBar = new TextView(this);
        urlBar.setSingleLine(true);
        urlBar.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        urlBar.setTextColor(Color.parseColor("#c8cdf0"));
        urlBar.setTextSize(12);
        urlBar.setBackgroundColor(Color.parseColor("#131829"));
        urlBar.setPadding(dp(10), dp(8), dp(10), dp(8));
        urlBar.setText(homeUrl);
        LinearLayout.LayoutParams urlLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        urlLp.setMargins(dp(4), 0, dp(4), 0);
        urlBar.setLayoutParams(urlLp);
        urlBar.setOnClickListener(v -> promptUrl());

        bar.addView(backBtn);
        bar.addView(forwardBtn);
        bar.addView(homeBtn);
        bar.addView(reloadBtn);
        bar.addView(urlBar);
        bar.addView(externalBtn);
        bar.addView(closeBtn);
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Thin progress
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgress(0);
        try { progress.getProgressDrawable().setColorFilter(Color.parseColor("#7c8cff"), android.graphics.PorterDuff.Mode.SRC_IN); } catch (Exception ignored) {}
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(2)));

        // WebView container
        FrameLayout webFrame = new FrameLayout(this);
        webFrame.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams wlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        root.addView(webFrame, wlp);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(MOBILE_UA);
        s.setSupportMultipleWindows(false);

        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            cm.setAcceptThirdPartyCookies(web, true);
        } catch (Exception ignored) {}

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String url = u != null ? u.toString() : "";
                if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("intent:")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                    catch (Exception e) {
                        Toast.makeText(ZaiWebActivity.this, "No app to handle: " + url, Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                urlBar.setText(url);
                updateNavButtons();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception e) {
                    Toast.makeText(ZaiWebActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                }
            }
        });

        webFrame.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Wire toolbar
        backBtn.setOnClickListener(v -> { if (web.canGoBack()) web.goBack(); });
        forwardBtn.setOnClickListener(v -> { if (web.canGoForward()) web.goForward(); });
        homeBtn.setOnClickListener(v -> web.loadUrl(homeUrl));
        reloadBtn.setOnClickListener(v -> web.reload());
        externalBtn.setOnClickListener(v -> openExternal(web.getUrl() != null ? web.getUrl() : homeUrl));
        closeBtn.setOnClickListener(v -> finish());

        setContentView(root);
        web.loadUrl(homeUrl);
    }

    private Button barBtn(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.parseColor("#e8eaff"));
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setTextSize(18);
        b.setMinWidth(dp(38));
        b.setMinHeight(dp(38));
        b.setPadding(dp(6), dp(2), dp(6), dp(2));
        b.setAllCaps(false);
        return b;
    }

    private void promptUrl() {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(web.getUrl() != null ? web.getUrl() : homeUrl);
        input.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI | android.text.InputType.TYPE_CLASS_TEXT);
        new AlertDialog.Builder(this)
            .setTitle("Ir a URL")
            .setView(input)
            .setPositiveButton("Ir", (d, w) -> {
                String url = input.getText().toString().trim();
                if (TextUtils.isEmpty(url)) return;
                if (!url.contains("://")) url = "https://" + url;
                web.loadUrl(url);
            })
            .setNeutralButton("Externo", (d, w) -> openExternal(input.getText().toString()))
            .setNegativeButton("Cancelar", null)
            .show();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            Toast.makeText(this, "No browser available", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateNavButtons() {
        backBtn.setAlpha(web.canGoBack() ? 1f : 0.35f);
        forwardBtn.setAlpha(web.canGoForward() ? 1f : 0.35f);
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            if (web != null) {
                web.stopLoading();
                web.loadUrl("about:blank");
                web.destroy();
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
