package com.opencode.android;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String CUSTOM_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenCodeBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setUserAgentString(CUSTOM_UA);
                settings.setDomStorageEnabled(true);
                settings.setJavaScriptEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}
