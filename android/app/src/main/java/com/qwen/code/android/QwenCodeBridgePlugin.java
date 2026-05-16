package com.qwen.code.android;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;

@CapacitorPlugin(
    name = "QwenCodeBridge",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE"
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
public class QwenCodeBridgePlugin extends Plugin {
    
    private static final String TAG = "QwenCodeBridge";
    private String workingDir;
    private static final int REQUEST_MANAGE_STORAGE = 1001;
    
    @Override
    public void load() {
        workingDir = Environment.getExternalStorageDirectory().getAbsolutePath();
        requestAllPermissions();
    }
    
    private void requestAllPermissions() {
        try {
            // Request storage permissions directly
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+ - request media permissions
                if (getActivity().checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                    getActivity().requestPermissions(new String[]{
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VIDEO,
                        Manifest.permission.READ_MEDIA_AUDIO
                    }, 100);
                }
            } else {
                // Android 12 and below - request storage permissions
                if (getActivity().checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    getActivity().requestPermissions(new String[]{
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    }, 101);
                }
            }
            
            // Request MANAGE_EXTERNAL_STORAGE for Android 11+ (all files access)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                        intent.setData(Uri.parse("package:" + getActivity().getPackageName()));
                        getActivity().startActivity(intent);
                    } catch (Exception e) {
                        // Fallback to general settings
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        getActivity().startActivity(intent);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting permissions: " + e.getMessage());
        }
    }
    
    @PermissionCallback
    private void storageCallback(PluginCall call) {
        // Permission callback
    }
    
    @PluginMethod
    public void isCapacitor(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean canRead = true;
        boolean canWrite = true;
        
        try {
            File testFile = new File(Environment.getExternalStorageDirectory(), ".qwencode_test");
            canWrite = testFile.createNewFile();
            if (canWrite) {
                canRead = testFile.exists();
                testFile.delete();
            }
        } catch (Exception e) {
            canRead = false;
            canWrite = false;
        }
        
        ret.put("canReadStorage", canRead);
        ret.put("canWriteStorage", canWrite);
        ret.put("hasAllFilesAccess", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? Environment.isExternalStorageManager() : true);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        requestAllPermissions();
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void executeShell(PluginCall call) {
        String command = call.getString("command", "");
        int timeout = call.getInt("timeout", 60);
        
        if (command.isEmpty()) {
            call.reject("Command is required");
            return;
        }
        
        new Thread(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder("sh", "-c", command);
                pb.directory(new File(workingDir));
                pb.redirectErrorStream(false);
                
                // Set environment variables
                java.util.Map<String, String> env = pb.environment();
                env.put("TERM", "xterm-256color");
                env.put("HOME", workingDir);
                env.put("PATH", System.getenv("PATH") + ":/data/data/com.qwen.code.android/files/usr/bin");
                
                Process process = pb.start();
                
                // Read stdout in a separate thread
                StringBuilder stdout = new StringBuilder();
                StringBuilder stderr = new StringBuilder();
                
                Thread stdoutThread = new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                        String line;
                        while ((line = reader.readLine()) != null) {
                            stdout.append(line).append("\n");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error reading stdout: " + e.getMessage());
                    }
                });
                
                Thread stderrThread = new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
                        String line;
                        while ((line = reader.readLine()) != null) {
                            stderr.append(line).append("\n");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error reading stderr: " + e.getMessage());
                    }
                });
                
                stdoutThread.start();
                stderrThread.start();
                
                boolean completed = process.waitFor(timeout, java.util.concurrent.TimeUnit.SECONDS);
                
                stdoutThread.join(2000);
                stderrThread.join(2000);
                
                int exitCode;
                if (!completed) {
                    process.destroyForcibly();
                    exitCode = -1;
                } else {
                    exitCode = process.exitValue();
                }
                
                JSObject ret = new JSObject();
                ret.put("stdout", stdout.toString().trim());
                ret.put("stderr", stderr.toString().trim());
                ret.put("exitCode", exitCode);
                
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("stdout", "");
                ret.put("stderr", e.getMessage());
                ret.put("exitCode", -1);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path", "");
        if (path.isEmpty()) {
            call.reject("Path is required");
            return;
        }
        
        new Thread(() -> {
            try {
                File file = resolvePath(path);
                if (!file.exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", "");
                    ret.put("error", "File not found: " + path);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                if (!file.isFile()) {
                    JSObject ret = new JSObject();
                    ret.put("value", "");
                    ret.put("error", "Not a file: " + path);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                if (!file.canRead()) {
                    JSObject ret = new JSObject();
                    ret.put("value", "");
                    ret.put("error", "Cannot read file (permission denied): " + path);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                // Read file with size limit
                long fileSize = file.length();
                int maxRead = 1024 * 1024; // 1MB limit
                
                BufferedReader reader = new BufferedReader(new FileReader(file));
                StringBuilder content = new StringBuilder();
                char[] buffer = new char[8192];
                int totalRead = 0;
                int charsRead;
                
                while ((charsRead = reader.read(buffer)) != -1 && totalRead < maxRead) {
                    content.append(buffer, 0, charsRead);
                    totalRead += charsRead;
                }
                reader.close();
                
                if (totalRead >= maxRead) {
                    content.append("\n... [File truncated at 1MB]");
                }
                
                JSObject ret = new JSObject();
                ret.put("value", content.toString());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", "");
                ret.put("error", "Read error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    @PluginMethod
    public void writeFile(PluginCall call) {
        String path = call.getString("path", "");
        String content = call.getString("content", "");
        
        if (path.isEmpty()) {
            call.reject("Path is required");
            return;
        }
        
        new Thread(() -> {
            try {
                File file = resolvePath(path);
                File parentDir = file.getParentFile();
                if (parentDir != null && !parentDir.exists()) {
                    parentDir.mkdirs();
                }
                
                FileOutputStream fos = new FileOutputStream(file);
                OutputStreamWriter writer = new OutputStreamWriter(fos, StandardCharsets.UTF_8);
                writer.write(content);
                writer.flush();
                writer.close();
                fos.close();
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Write error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    @PluginMethod
    public void listDir(PluginCall call) {
        String path = call.getString("path", "");
        boolean showHidden = call.getBoolean("showHidden", false);
        
        new Thread(() -> {
            try {
                File dir = resolvePath(path.isEmpty() ? workingDir : path);
                if (!dir.exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "Directory not found: " + path);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                if (!dir.isDirectory()) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "Not a directory: " + path);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                File[] files = dir.listFiles();
                JSArray entries = new JSArray();
                
                if (files != null) {
                    Arrays.sort(files, (a, b) -> {
                        if (a.isDirectory() != b.isDirectory()) return a.isDirectory() ? -1 : 1;
                        return a.getName().compareToIgnoreCase(b.getName());
                    });
                    
                    for (File f : files) {
                        if (!showHidden && f.getName().startsWith(".")) continue;
                        
                        JSObject entry = new JSObject();
                        entry.put("name", f.getName());
                        entry.put("path", f.getAbsolutePath());
                        entry.put("isDir", f.isDirectory());
                        entry.put("isFile", f.isFile());
                        entry.put("size", f.length());
                        entry.put("lastModified", f.lastModified());
                        entry.put("canRead", f.canRead());
                        entry.put("canWrite", f.canWrite());
                        entry.put("isHidden", f.isHidden());
                        entries.put(entry);
                    }
                }
                
                JSObject ret = new JSObject();
                ret.put("value", entries);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "List error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    @PluginMethod
    public void exists(PluginCall call) {
        String path = call.getString("path", "");
        
        try {
            File file = resolvePath(path);
            JSObject ret = new JSObject();
            ret.put("value", file.exists());
            ret.put("isFile", file.isFile());
            ret.put("isDir", file.isDirectory());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }
    
    @PluginMethod
    public void delete(PluginCall call) {
        String path = call.getString("path", "");
        boolean recursive = call.getBoolean("recursive", false);
        
        try {
            File file = resolvePath(path);
            boolean deleted;
            if (recursive && file.isDirectory()) {
                deleted = deleteRecursive(file);
            } else {
                deleted = file.delete();
            }
            JSObject ret = new JSObject();
            ret.put("value", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }
    
    private boolean deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        return file.delete();
    }
    
    @PluginMethod
    public void move(PluginCall call) {
        String source = call.getString("source", "");
        String destination = call.getString("destination", "");
        
        try {
            File src = resolvePath(source);
            File dst = resolvePath(destination);
            
            // Ensure destination parent exists
            if (dst.getParentFile() != null) {
                dst.getParentFile().mkdirs();
            }
            
            boolean moved = src.renameTo(dst);
            JSObject ret = new JSObject();
            ret.put("value", moved);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }
    
    @PluginMethod
    public void copy(PluginCall call) {
        String source = call.getString("source", "");
        String destination = call.getString("destination", "");
        
        new Thread(() -> {
            try {
                File src = resolvePath(source);
                File dst = resolvePath(destination);
                
                if (dst.getParentFile() != null) {
                    dst.getParentFile().mkdirs();
                }
                
                Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING);
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Copy error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    @PluginMethod
    public void mkdir(PluginCall call) {
        String path = call.getString("path", "");
        
        try {
            File dir = resolvePath(path);
            boolean created = dir.mkdirs();
            JSObject ret = new JSObject();
            ret.put("value", created || dir.exists());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }
    
    @PluginMethod
    public void getHomeDir(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", Environment.getExternalStorageDirectory().getAbsolutePath());
        call.resolve(ret);
    }
    
    @PluginMethod
    public void getWorkingDir(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", workingDir);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void setWorkingDir(PluginCall call) {
        String dir = call.getString("dir", "");
        
        try {
            File newDir = resolvePath(dir);
            if (newDir.exists() && newDir.isDirectory()) {
                workingDir = newDir.getAbsolutePath();
                JSObject ret = new JSObject();
                ret.put("value", true);
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Not a directory: " + dir);
                call.resolve(ret);
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }
    
    /**
     * Native HTTP request - bypasses WebView CORS restrictions.
     * This is the key tool for web_fetch, web_search, and web_scrape.
     */
    @PluginMethod
    public void httpRequest(PluginCall call) {
        String urlStr = call.getString("url", "");
        String method = call.getString("method", "GET");
        String body = call.getString("body", "");
        JSObject headers = call.getObject("headers", new JSObject());
        int timeoutMs = call.getInt("timeout", 30000);
        boolean followRedirects = call.getBoolean("followRedirects", true);
        
        if (urlStr.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        
        new Thread(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(timeoutMs);
                conn.setReadTimeout(timeoutMs);
                conn.setInstanceFollowRedirects(followRedirects);
                
                // Set default headers
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36");
                conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.5");
                
                // Apply custom headers
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    conn.setRequestProperty(key, headers.getString(key));
                }
                
                // Write body if present
                if (!body.isEmpty() && (method.equals("POST") || method.equals("PUT") || method.equals("PATCH"))) {
                    conn.setDoOutput(true);
                    byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
                    conn.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
                    conn.getOutputStream().write(bodyBytes);
                }
                
                int responseCode = conn.getResponseCode();
                
                // Read response
                BufferedReader reader;
                if (responseCode >= 200 && responseCode < 400) {
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                } else {
                    reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8));
                }
                
                StringBuilder response = new StringBuilder();
                char[] buffer = new char[8192];
                int totalRead = 0;
                int maxResponseSize = 512 * 1024; // 512KB max
                int charsRead;
                
                while ((charsRead = reader.read(buffer)) != -1 && totalRead < maxResponseSize) {
                    response.append(buffer, 0, charsRead);
                    totalRead += charsRead;
                }
                reader.close();
                
                if (totalRead >= maxResponseSize) {
                    response.append("\n... [Response truncated at 512KB]");
                }
                
                // Get response headers
                JSObject responseHeaders = new JSObject();
                for (String key : conn.getHeaderFields().keySet()) {
                    if (key != null) {
                        responseHeaders.put(key, conn.getHeaderField(key));
                    }
                }
                
                JSObject ret = new JSObject();
                ret.put("status", responseCode);
                ret.put("body", response.toString());
                ret.put("headers", responseHeaders);
                ret.put("url", conn.getURL().toString()); // Final URL after redirects
                
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("status", -1);
                ret.put("body", "");
                ret.put("error", "HTTP error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }
    
    private File resolvePath(String path) {
        // Expand common Android paths
        if (path.equals("~") || path.equals("~/")) {
            return new File(workingDir);
        }
        if (path.startsWith("~/")) {
            return new File(workingDir, path.substring(2));
        }
        
        // Handle /sdcard path
        if (path.startsWith("/sdcard")) {
            String expanded = path.replaceFirst("/sdcard", Environment.getExternalStorageDirectory().getAbsolutePath());
            return new File(expanded);
        }
        
        File file = new File(path);
        if (!file.isAbsolute()) {
            file = new File(workingDir, path);
        }
        return file;
    }
}
