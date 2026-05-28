package com.opencode.android;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;

/**
 * OpenCodeBridgePlugin - Capacitor plugin for OpenCode Android v2.
 *
 * Provides native bridge functionality:
 *  - Shell command execution (sh -c)
 *  - File ops (read, write, append, edit, list, delete, move, copy, mkdir, exists)
 *  - HTTP requests (bypasses CORS, with retries)
 *  - Clipboard read/write
 *  - Vibrate, toast
 *  - Device info
 */
@CapacitorPlugin(
    name = "OpenCodeBridge",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        ),
        @Permission(
            alias = "media",
            strings = {
                "android.permission.READ_MEDIA_IMAGES",
                "android.permission.READ_MEDIA_VIDEO",
                "android.permission.READ_MEDIA_AUDIO"
            }
        )
    }
)
public class OpenCodeBridgePlugin extends Plugin {

    private static final String TAG = "OpenCodeBridge";
    private String workingDir;

    @Override
    public void load() {
        workingDir = Environment.getExternalStorageDirectory().getAbsolutePath();
        requestAllPermissions();
    }

    private void requestAllPermissions() {
        try {
            ArrayList<String> perms = new ArrayList<>();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                perms.add("android.permission.READ_MEDIA_IMAGES");
                perms.add("android.permission.READ_MEDIA_VIDEO");
                perms.add("android.permission.READ_MEDIA_AUDIO");
            } else {
                perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
            getActivity().requestPermissions(perms.toArray(new String[0]), 200);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                        intent.setData(Uri.parse("package:" + getActivity().getPackageName()));
                        getActivity().startActivity(intent);
                    } catch (Exception e) {
                        try {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                            getActivity().startActivity(intent);
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Permissions error: " + e.getMessage());
        }
    }

    // ==========================================
    // Basic
    // ==========================================

    @PluginMethod
    public void isCapacitor(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean canRead = true, canWrite = true;
        try {
            File testFile = new File(Environment.getExternalStorageDirectory(), ".oc_test");
            canWrite = testFile.createNewFile();
            if (canWrite) { canRead = testFile.exists(); testFile.delete(); }
        } catch (Exception e) { canRead = false; canWrite = false; }
        ret.put("canReadStorage", canRead);
        ret.put("canWriteStorage", canWrite);
        ret.put("hasAllFilesAccess", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? Environment.isExternalStorageManager() : true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        requestAllPermissions();
        JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
    }

    // ==========================================
    // Shell
    // ==========================================

    @PluginMethod
    public void executeShell(PluginCall call) {
        final String command = call.getString("command", "");
        final int timeout = call.getInt("timeout", 60);
        final String cwd = call.getString("cwd", "");
        if (command == null || command.isEmpty()) { call.reject("command required"); return; }

        new Thread(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder("sh", "-c", command);
                File wd = (cwd != null && !cwd.isEmpty()) ? new File(cwd) : new File(workingDir);
                if (wd.exists() && wd.isDirectory()) pb.directory(wd);
                pb.redirectErrorStream(false);

                java.util.Map<String, String> env = pb.environment();
                env.put("TERM", "xterm-256color");
                env.put("HOME", workingDir);
                String basePath = System.getenv("PATH");
                env.put("PATH", (basePath == null ? "/system/bin:/system/xbin" : basePath)
                    + ":/data/data/com.opencode.android/files/usr/bin");

                Process process = pb.start();
                final StringBuilder stdout = new StringBuilder();
                final StringBuilder stderr = new StringBuilder();

                Thread t1 = new Thread(() -> {
                    try (BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                        String line; while ((line = r.readLine()) != null) stdout.append(line).append('\n');
                    } catch (Exception ignored) {}
                });
                Thread t2 = new Thread(() -> {
                    try (BufferedReader r = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                        String line; while ((line = r.readLine()) != null) stderr.append(line).append('\n');
                    } catch (Exception ignored) {}
                });
                t1.start(); t2.start();

                boolean ok = process.waitFor(timeout, TimeUnit.SECONDS);
                t1.join(2000); t2.join(2000);

                int exit;
                if (!ok) { process.destroyForcibly(); exit = 124; stderr.append("\n[timeout]\n"); }
                else exit = process.exitValue();

                JSObject ret = new JSObject();
                ret.put("stdout", stdout.toString());
                ret.put("stderr", stderr.toString());
                ret.put("exitCode", exit);
                resolveOnMain(call, ret);
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("stdout", "");
                ret.put("stderr", e.getMessage());
                ret.put("exitCode", 1);
                resolveOnMain(call, ret);
            }
        }).start();
    }

    // ==========================================
    // File ops
    // ==========================================

    @PluginMethod
    public void readFile(PluginCall call) {
        final String path = call.getString("path", "");
        if (path == null || path.isEmpty()) { call.reject("path required"); return; }
        new Thread(() -> {
            try {
                File f = resolvePath(path);
                if (!f.exists()) { call.reject("File not found: " + path); return; }
                if (f.length() > 10L * 1024 * 1024) { call.reject("File too large (>10MB)"); return; }
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new FileReader(f))) {
                    char[] buf = new char[8192]; int n;
                    while ((n = r.read(buf)) != -1) sb.append(buf, 0, n);
                }
                JSObject ret = new JSObject();
                ret.put("content", sb.toString());
                ret.put("size", f.length());
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        final String path = call.getString("path", "");
        final String content = call.getString("content", "");
        new Thread(() -> {
            try {
                File f = resolvePath(path);
                File parent = f.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }
                JSObject ret = new JSObject();
                ret.put("value", true);
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void appendFile(PluginCall call) {
        final String path = call.getString("path", "");
        final String content = call.getString("content", "");
        new Thread(() -> {
            try {
                File f = resolvePath(path);
                File parent = f.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream out = new FileOutputStream(f, true)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }
                JSObject ret = new JSObject();
                ret.put("value", true);
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void fileEdit(PluginCall call) {
        final String path = call.getString("path", "");
        final String oldText = call.getString("oldText", "");
        final String newText = call.getString("newText", "");
        new Thread(() -> {
            try {
                File f = resolvePath(path);
                if (!f.exists()) { call.reject("File not found: " + path); return; }
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new FileReader(f))) {
                    char[] buf = new char[8192]; int n;
                    while ((n = r.read(buf)) != -1) sb.append(buf, 0, n);
                }
                String text = sb.toString();
                int idx = text.indexOf(oldText);
                if (idx == -1) { call.reject("old_text not found in file"); return; }
                int last = text.lastIndexOf(oldText);
                if (idx != last) { call.reject("old_text appears multiple times — make it unique"); return; }
                String updated = text.substring(0, idx) + newText + text.substring(idx + oldText.length());
                try (FileOutputStream out = new FileOutputStream(f)) {
                    out.write(updated.getBytes(StandardCharsets.UTF_8));
                }
                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("message", "replaced 1 occurrence");
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void listDir(PluginCall call) {
        final String path = call.getString("path", workingDir);
        final boolean showHidden = call.getBoolean("showHidden", false);
        try {
            File dir = resolvePath(path);
            if (!dir.exists() || !dir.isDirectory()) { call.reject("Not a directory: " + path); return; }
            File[] files = dir.listFiles();
            JSArray arr = new JSArray();
            if (files != null) {
                for (File f : files) {
                    if (!showHidden && f.getName().startsWith(".")) continue;
                    JSObject e = new JSObject();
                    e.put("name", f.getName());
                    e.put("isDir", f.isDirectory());
                    e.put("size", f.length());
                    e.put("modified", f.lastModified());
                    arr.put(e);
                }
            }
            JSObject ret = new JSObject(); ret.put("entries", arr);
            call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void exists(PluginCall call) {
        String path = call.getString("path", "");
        JSObject ret = new JSObject();
        try { ret.put("exists", resolvePath(path).exists()); }
        catch (Exception e) { ret.put("exists", false); }
        call.resolve(ret);
    }

    @PluginMethod
    public void delete(PluginCall call) {
        final String path = call.getString("path", "");
        final boolean recursive = call.getBoolean("recursive", false);
        new Thread(() -> {
            try {
                File f = resolvePath(path);
                if (!f.exists()) { call.reject("Not found: " + path); return; }
                if (f.isDirectory() && recursive) deleteRecursive(f);
                else if (!f.delete()) { call.reject("Cannot delete: " + path); return; }
                JSObject ret = new JSObject(); ret.put("value", true);
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }
    private void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        f.delete();
    }

    @PluginMethod
    public void move(PluginCall call) {
        final String src = call.getString("source", "");
        final String dst = call.getString("destination", "");
        new Thread(() -> {
            try {
                File s = resolvePath(src);
                File d = resolvePath(dst);
                if (d.getParentFile() != null && !d.getParentFile().exists()) d.getParentFile().mkdirs();
                Files.move(s.toPath(), d.toPath(), StandardCopyOption.REPLACE_EXISTING);
                JSObject ret = new JSObject(); ret.put("value", true);
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void copy(PluginCall call) {
        final String src = call.getString("source", "");
        final String dst = call.getString("destination", "");
        new Thread(() -> {
            try {
                File s = resolvePath(src);
                File d = resolvePath(dst);
                if (d.getParentFile() != null && !d.getParentFile().exists()) d.getParentFile().mkdirs();
                if (s.isDirectory()) copyDir(s, d);
                else Files.copy(s.toPath(), d.toPath(), StandardCopyOption.REPLACE_EXISTING);
                JSObject ret = new JSObject(); ret.put("value", true);
                resolveOnMain(call, ret);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }
    private void copyDir(File src, File dst) throws Exception {
        if (!dst.exists()) dst.mkdirs();
        File[] kids = src.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            File t = new File(dst, k.getName());
            if (k.isDirectory()) copyDir(k, t);
            else Files.copy(k.toPath(), t.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        try {
            File f = resolvePath(call.getString("path", ""));
            boolean ok = f.mkdirs() || f.isDirectory();
            JSObject ret = new JSObject(); ret.put("value", ok);
            call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getHomeDir(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", Environment.getExternalStorageDirectory().getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void getWorkingDir(PluginCall call) {
        JSObject ret = new JSObject(); ret.put("value", workingDir); call.resolve(ret);
    }

    @PluginMethod
    public void setWorkingDir(PluginCall call) {
        String dir = call.getString("dir", "");
        try {
            File f = resolvePath(dir);
            if (f.exists() && f.isDirectory()) {
                workingDir = f.getAbsolutePath();
                JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
            } else { call.reject("Not a directory: " + dir); }
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    // ==========================================
    // HTTP
    // ==========================================

    @PluginMethod
    public void httpRequest(PluginCall call) {
        final String urlStr = call.getString("url", "");
        final String method = call.getString("method", "GET");
        final String body = call.getString("body", "");
        final JSObject headers = call.getObject("headers", new JSObject());
        final int timeoutSec = call.getInt("timeout", 120);
        final boolean followRedirects = call.getBoolean("followRedirects", true);
        final int retries = call.getInt("retries", 2);

        if (urlStr == null || urlStr.isEmpty()) { call.reject("url required"); return; }

        new Thread(() -> {
            Exception last = null;
            for (int attempt = 0; attempt <= retries; attempt++) {
                try {
                    if (attempt > 0) Thread.sleep(Math.min(1500L * attempt, 4000L));

                    URL url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod(method);
                    conn.setConnectTimeout(Math.max(timeoutSec * 1000, 20000));
                    conn.setReadTimeout(Math.max(timeoutSec * 1000, 60000));
                    conn.setInstanceFollowRedirects(followRedirects);

                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
                    conn.setRequestProperty("Accept", "*/*");
                    conn.setRequestProperty("Accept-Encoding", "identity");

                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        conn.setRequestProperty(k, headers.getString(k));
                    }

                    if (body != null && !body.isEmpty() && ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method))) {
                        conn.setDoOutput(true);
                        byte[] b = body.getBytes(StandardCharsets.UTF_8);
                        conn.setRequestProperty("Content-Length", String.valueOf(b.length));
                        conn.getOutputStream().write(b);
                        conn.getOutputStream().flush();
                    }

                    int code = conn.getResponseCode();
                    java.io.InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                    if (is == null) is = conn.getInputStream();

                    StringBuilder resp = new StringBuilder();
                    try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        char[] buf = new char[8192]; int n; int total = 0; int max = 4 * 1024 * 1024;
                        while ((n = r.read(buf)) != -1 && total < max) { resp.append(buf, 0, n); total += n; }
                    }

                    JSObject ret = new JSObject();
                    ret.put("status", code);
                    ret.put("body", resp.toString());
                    resolveOnMain(call, ret);
                    return;
                } catch (Exception e) {
                    last = e;
                    Log.w(TAG, "HTTP attempt " + (attempt + 1) + " failed: " + e.getMessage());
                }
            }
            JSObject ret = new JSObject();
            ret.put("status", 0);
            ret.put("body", "");
            ret.put("error", last != null ? last.getMessage() : "Network error");
            resolveOnMain(call, ret);
        }).start();
    }

    // ==========================================
    // Clipboard / Toast / Vibrate / Device
    // ==========================================

    @PluginMethod
    public void readClipboard(PluginCall call) {
        try {
            ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
            String text = "";
            if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null
                && cm.getPrimaryClip().getItemCount() > 0) {
                CharSequence cs = cm.getPrimaryClip().getItemAt(0).getText();
                if (cs != null) text = cs.toString();
            }
            JSObject ret = new JSObject(); ret.put("value", text); call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void writeClipboard(PluginCall call) {
        final String text = call.getString("text", "");
        try {
            new Handler(Looper.getMainLooper()).post(() -> {
                ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("OpenCode", text));
            });
            JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void showToast(PluginCall call) {
        final String message = call.getString("message", "");
        try {
            new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show());
            JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        final int ms = call.getInt("ms", 30);
        try {
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(ms);
                }
            }
            JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("brand", Build.BRAND);
            ret.put("androidVersion", Build.VERSION.RELEASE);
            ret.put("sdkVersion", Build.VERSION.SDK_INT);
            ret.put("isRooted", isRooted());
            JSArray abis = new JSArray();
            for (String a : Build.SUPPORTED_ABIS) abis.put(a);
            ret.put("abis", abis);
            File data = Environment.getDataDirectory();
            ret.put("totalStorage", data.getTotalSpace());
            ret.put("freeStorage", data.getFreeSpace());
            call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    private boolean isRooted() {
        try {
            String[] paths = {"/system/app/Superuser.apk", "/sbin/su", "/system/bin/su",
                              "/system/xbin/su", "/data/local/xbin/su", "/data/local/bin/su"};
            for (String p : paths) if (new File(p).exists()) return true;
            Process pr = Runtime.getRuntime().exec(new String[]{"which", "su"});
            return pr.waitFor() == 0;
        } catch (Exception e) { return false; }
    }

    // ==========================================
    // In-app browser (used for Z.AI chat web view)
    // ==========================================

    @PluginMethod
    public void openWebView(PluginCall call) {
        final String url = call.getString("url", "https://chat.z.ai");
        final String title = call.getString("title", "Z.AI");
        try {
            new Handler(Looper.getMainLooper()).post(() -> {
                Intent i = new Intent(getActivity(), ZaiWebActivity.class);
                i.putExtra(ZaiWebActivity.EXTRA_URL, url);
                i.putExtra(ZaiWebActivity.EXTRA_TITLE, title);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(i);
            });
            JSObject ret = new JSObject(); ret.put("value", true); call.resolve(ret);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    // ==========================================
    // Helpers
    // ==========================================

    private File resolvePath(String path) {
        if (path == null || path.isEmpty()) return new File(workingDir);
        if (path.startsWith("/")) return new File(path);
        if (path.startsWith("~/") || path.startsWith("~\\")) return new File(workingDir, path.substring(2));
        if (path.equals("~")) return new File(workingDir);
        return new File(workingDir, path);
    }

    private void resolveOnMain(PluginCall call, JSObject ret) {
        new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
    }
}
