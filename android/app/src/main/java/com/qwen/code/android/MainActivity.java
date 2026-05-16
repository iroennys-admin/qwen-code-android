package com.qwen.code.android;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final String CUSTOM_USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 QwenCode/1.1";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QwenCodeBridgePlugin.class);
        registerPlugin(ZAIWebViewPlugin.class);
        super.onCreate(savedInstanceState);
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Set custom User-Agent on the Capacitor WebView to bypass Cloudflare
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                String defaultUA = settings.getUserAgentString();
                if (!defaultUA.contains("QwenCode")) {
                    settings.setUserAgentString(CUSTOM_USER_AGENT);
                }
            }
        } catch (Exception e) {
            // WebView not ready yet, will be set on next resume
        }
    }
}
