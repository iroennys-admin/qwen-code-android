package com.qwen.code.android;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.util.Log;
import android.widget.Toast;

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
        ),
        @Permission(
            alias = "sms",
            strings = {
                "android.permission.SEND_SMS",
                "android.permission.READ_SMS"
            }
        ),
        @Permission(
            alias = "phone",
            strings = {
                "android.permission.CALL_PHONE",
                "android.permission.READ_CALL_LOG",
                "android.permission.READ_PHONE_STATE"
            }
        ),
        @Permission(
            alias = "contacts",
            strings = {
                "android.permission.READ_CONTACTS",
                "android.permission.WRITE_CONTACTS"
            }
        ),
        @Permission(
            alias = "notifications",
            strings = {
                "android.permission.POST_NOTIFICATIONS"
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
            // Request storage permissions
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissionForAliases(new String[]{"media", "sms", "phone", "contacts", "notifications"});
            } else {
                requestPermissionForAliases(new String[]{"storage", "sms", "phone", "contacts"});
            }
            
            // Request MANAGE_EXTERNAL_STORAGE for Android 11+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                        intent.setData(Uri.parse("package:" + getActivity().getPackageName()));
                        getActivity().startActivity(intent);
                    } catch (Exception e) {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        getActivity().startActivity(intent);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting permissions: " + e.getMessage());
        }
    }
    
    private void requestPermissionForAliases(String[] aliases) {
        try {
            // Use Capacitor's built-in permission request
            for (String alias : aliases) {
                requestPermission(alias, null);
            }
        } catch (Exception e) {
            // Fallback: request directly
            try {
                ArrayList<String> perms = new ArrayList<>();
                if (contains(aliases, "storage")) {
                    perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                    perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                }
                if (contains(aliases, "media")) {
                    perms.add(Manifest.permission.READ_MEDIA_IMAGES);
                    perms.add(Manifest.permission.READ_MEDIA_VIDEO);
                    perms.add(Manifest.permission.READ_MEDIA_AUDIO);
                }
                if (contains(aliases, "sms")) {
                    perms.add(Manifest.permission.SEND_SMS);
                    perms.add(Manifest.permission.READ_SMS);
                }
                if (contains(aliases, "phone")) {
                    perms.add(Manifest.permission.CALL_PHONE);
                    perms.add(Manifest.permission.READ_CALL_LOG);
                    perms.add(Manifest.permission.READ_PHONE_STATE);
                }
                if (contains(aliases, "contacts")) {
                    perms.add(Manifest.permission.READ_CONTACTS);
                    perms.add(Manifest.permission.WRITE_CONTACTS);
                }
                if (contains(aliases, "notifications") && Build.VERSION.SDK_INT >= 33) {
                    perms.add("android.permission.POST_NOTIFICATIONS");
                }
                if (!perms.isEmpty()) {
                    getActivity().requestPermissions(perms.toArray(new String[0]), 200);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Fallback permission request failed: " + ex.getMessage());
            }
        }
    }
    
    private boolean contains(String[] arr, String val) {
        for (String s : arr) if (s.equals(val)) return true;
        return false;
    }
    
    @PermissionCallback
    private void storageCallback(PluginCall call) {}
    
    // ==========================================
    // Basic Plugin Methods
    // ==========================================
    
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
        ret.put("hasSmsPermission", getActivity().checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED);
        ret.put("hasCallPermission", getActivity().checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED);
        ret.put("hasContactsPermission", getActivity().checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED);
        ret.put("hasAccessibility", QwenAccessibilityService.isRunning());
        ret.put("hasNotificationAccess", QwenNotificationListener.isRunning());
        call.resolve(ret);
    }
    
    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        requestAllPermissions();
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }

    // ==========================================
    // Shell Execution
    // ==========================================

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
                
                java.util.Map<String, String> env = pb.environment();
                env.put("TERM", "xterm-256color");
                env.put("HOME", workingDir);
                env.put("PATH", System.getenv("PATH") + ":/data/data/com.qwen.code.android/files/usr/bin");
                
                Process process = pb.start();
                
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

    // ==========================================
    // File Operations (Full Filesystem Access)
    // ==========================================

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
                
                long fileSize = file.length();
                int maxRead = 2 * 1024 * 1024; // 2MB limit (increased from 1MB)
                
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
                    content.append("\n... [File truncated at 2MB]");
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
            if (dst.getParentFile() != null) dst.getParentFile().mkdirs();
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
                if (dst.getParentFile() != null) dst.getParentFile().mkdirs();
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

    // ==========================================
    // HTTP Request (Native - Bypasses CORS)
    // ==========================================

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
                
                // Set default headers for web scraping
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36");
                conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.5");
                conn.setRequestProperty("Accept-Encoding", "identity"); // Avoid gzip issues
                
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
                
                BufferedReader reader;
                if (responseCode >= 200 && responseCode < 400) {
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                } else {
                    java.io.InputStream errStream = conn.getErrorStream();
                    if (errStream != null) {
                        reader = new BufferedReader(new InputStreamReader(errStream, StandardCharsets.UTF_8));
                    } else {
                        reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    }
                }
                
                StringBuilder response = new StringBuilder();
                char[] buffer = new char[8192];
                int totalRead = 0;
                int maxResponseSize = 1024 * 1024; // 1MB max (increased from 512KB)
                int charsRead;
                
                while ((charsRead = reader.read(buffer)) != -1 && totalRead < maxResponseSize) {
                    response.append(buffer, 0, charsRead);
                    totalRead += charsRead;
                }
                reader.close();
                
                if (totalRead >= maxResponseSize) {
                    response.append("\n... [Response truncated at 1MB]");
                }
                
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
                ret.put("url", conn.getURL().toString());
                
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

    // ==========================================
    // SMS Operations
    // ==========================================

    @PluginMethod
    public void sendSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String message = call.getString("message", "");
        
        if (phoneNumber.isEmpty() || message.isEmpty()) {
            call.reject("Phone number and message are required");
            return;
        }
        
        new Thread(() -> {
            try {
                if (getActivity().checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "SMS permission not granted. Go to Settings > Apps > Qwen Code > Permissions and enable SMS.");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                SmsManager smsManager;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    smsManager = getActivity().getSystemService(SmsManager.class);
                } else {
                    smsManager = SmsManager.getDefault();
                }
                
                // Split long messages
                ArrayList<String> parts = smsManager.divideMessage(message);
                if (parts.size() > 1) {
                    smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
                } else {
                    smsManager.sendTextMessage(phoneNumber, null, message, null, null);
                }
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "SMS error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void readSms(PluginCall call) {
        int limit = call.getInt("limit", 20);
        String phoneNumber = call.getString("phoneNumber", "");
        
        new Thread(() -> {
            try {
                if (getActivity().checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "SMS read permission not granted");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                ContentResolver resolver = getActivity().getContentResolver();
                Uri uri = Telephony.Sms.CONTENT_URI;
                String[] projection = {"_id", "address", "body", "date", "type"};
                String selection = phoneNumber.isEmpty() ? null : "address LIKE ?";
                String[] selectionArgs = phoneNumber.isEmpty() ? null : new String[]{"%" + phoneNumber + "%"};
                String sortOrder = "date DESC LIMIT " + limit;
                
                Cursor cursor = resolver.query(uri, projection, selection, selectionArgs, sortOrder);
                JSArray messages = new JSArray();
                
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        JSObject sms = new JSObject();
                        sms.put("id", cursor.getString(0));
                        sms.put("address", cursor.getString(1));
                        sms.put("body", cursor.getString(2));
                        sms.put("date", cursor.getLong(3));
                        int type = cursor.getInt(4);
                        sms.put("type", type == 1 ? "received" : type == 2 ? "sent" : "other");
                        messages.put(sms);
                    }
                    cursor.close();
                }
                
                JSObject ret = new JSObject();
                ret.put("value", messages);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "Read SMS error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Phone / Call Operations
    // ==========================================

    @PluginMethod
    public void makeCall(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        
        if (phoneNumber.isEmpty()) {
            call.reject("Phone number is required");
            return;
        }
        
        try {
            if (getActivity().checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                Intent callIntent = new Intent(Intent.ACTION_CALL);
                callIntent.setData(Uri.parse("tel:" + phoneNumber));
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(callIntent);
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                call.resolve(ret);
            } else {
                // Fallback: open dialer
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.setData(Uri.parse("tel:" + phoneNumber));
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(dialIntent);
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("note", "Opened dialer (no CALL_PHONE permission, user must press call)");
                call.resolve(ret);
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Call error: " + e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void readCallLog(PluginCall call) {
        int limit = call.getInt("limit", 20);
        
        new Thread(() -> {
            try {
                if (getActivity().checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "Call log permission not granted");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                ContentResolver resolver = getActivity().getContentResolver();
                String[] projection = {"number", "date", "duration", "type", "name"};
                String sortOrder = "date DESC LIMIT " + limit;
                
                Cursor cursor = resolver.query(
                    android.provider.CallLog.Calls.CONTENT_URI,
                    projection, null, null, sortOrder
                );
                
                JSArray calls = new JSArray();
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        JSObject callLog = new JSObject();
                        callLog.put("number", cursor.getString(0));
                        callLog.put("date", cursor.getLong(1));
                        callLog.put("duration", cursor.getString(2));
                        int type = cursor.getInt(3);
                        String typeStr = type == android.provider.CallLog.Calls.INCOMING_TYPE ? "incoming" :
                                        type == android.provider.CallLog.Calls.OUTGOING_TYPE ? "outgoing" :
                                        type == android.provider.CallLog.Calls.MISSED_TYPE ? "missed" : "other";
                        callLog.put("type", typeStr);
                        callLog.put("name", cursor.getString(4));
                        calls.put(callLog);
                    }
                    cursor.close();
                }
                
                JSObject ret = new JSObject();
                ret.put("value", calls);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "Call log error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Contacts
    // ==========================================

    @PluginMethod
    public void readContacts(PluginCall call) {
        int limit = call.getInt("limit", 50);
        String search = call.getString("search", "");
        
        new Thread(() -> {
            try {
                if (getActivity().checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "Contacts permission not granted");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                ContentResolver resolver = getActivity().getContentResolver();
                String selection = search.isEmpty() ? null : 
                    ContactsContract.Contacts.DISPLAY_NAME + " LIKE ?";
                String[] selectionArgs = search.isEmpty() ? null : new String[]{"%" + search + "%"};
                
                Cursor cursor = resolver.query(
                    ContactsContract.Contacts.CONTENT_URI,
                    new String[]{ContactsContract.Contacts._ID, ContactsContract.Contacts.DISPLAY_NAME},
                    selection, selectionArgs,
                    ContactsContract.Contacts.DISPLAY_NAME + " LIMIT " + limit
                );
                
                JSArray contacts = new JSArray();
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        JSObject contact = new JSObject();
                        String contactId = cursor.getString(0);
                        contact.put("id", contactId);
                        contact.put("name", cursor.getString(1));
                        
                        // Get phone numbers
                        Cursor phoneCursor = resolver.query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},
                            ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                            new String[]{contactId},
                            null
                        );
                        
                        JSArray phones = new JSArray();
                        if (phoneCursor != null) {
                            while (phoneCursor.moveToNext()) {
                                phones.put(phoneCursor.getString(0));
                            }
                            phoneCursor.close();
                        }
                        contact.put("phones", phones);
                        contacts.put(contact);
                    }
                    cursor.close();
                }
                
                JSObject ret = new JSObject();
                ret.put("value", contacts);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "Contacts error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // WhatsApp
    // ==========================================

    @PluginMethod
    public void sendWhatsApp(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        String message = call.getString("message", "");
        
        try {
            Intent intent;
            if (!phoneNumber.isEmpty()) {
                // Send to specific number
                String uri = "https://wa.me/" + phoneNumber.replace("+", "").replace(" ", "").replace("-", "") + "?text=" + Uri.encode(message);
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            } else if (!message.isEmpty()) {
                // Share text via WhatsApp (picks contact)
                intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_TEXT, message);
                intent.setPackage("com.whatsapp");
            } else {
                call.reject("Phone number or message is required");
                return;
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // Check if WhatsApp is installed
            try {
                getActivity().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("value", true);
                call.resolve(ret);
            } catch (android.content.ActivityNotFoundException e) {
                // Try WhatsApp Business
                if (!phoneNumber.isEmpty()) {
                    // Fallback to just opening WhatsApp
                    intent = getActivity().getPackageManager().getLaunchIntentForPackage("com.whatsapp");
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(intent);
                        JSObject ret = new JSObject();
                        ret.put("value", true);
                        ret.put("note", "WhatsApp opened but could not auto-send. WhatsApp may not be installed.");
                        call.resolve(ret);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("value", false);
                        ret.put("error", "WhatsApp is not installed on this device");
                        call.resolve(ret);
                    }
                } else {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "WhatsApp is not installed");
                    call.resolve(ret);
                }
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "WhatsApp error: " + e.getMessage());
            call.resolve(ret);
        }
    }

    // ==========================================
    // App Management
    // ==========================================

    @PluginMethod
    public void launchApp(PluginCall call) {
        String packageName = call.getString("packageName", "");
        String action = call.getString("action", "");
        String data = call.getString("data", "");
        
        try {
            Intent intent;
            
            if (!action.isEmpty()) {
                intent = new Intent(action);
                if (!data.isEmpty()) {
                    intent.setData(Uri.parse(data));
                }
            } else if (!packageName.isEmpty()) {
                intent = getActivity().getPackageManager().getLaunchIntentForPackage(packageName);
                if (intent == null) {
                    // Try to open app settings
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + packageName));
                }
            } else {
                call.reject("Package name or action is required");
                return;
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Launch error: " + e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void listInstalledApps(PluginCall call) {
        new Thread(() -> {
            try {
                java.util.List<android.content.pm.ApplicationInfo> apps = 
                    getActivity().getPackageManager().getInstalledApplications(PackageManager.GET_META_DATA);
                
                JSArray appList = new JSArray();
                for (android.content.pm.ApplicationInfo appInfo : apps) {
                    try {
                        JSObject app = new JSObject();
                        app.put("packageName", appInfo.packageName);
                        String name = getActivity().getPackageManager().getApplicationLabel(appInfo).toString();
                        app.put("name", name);
                        app.put("isSystem", (appInfo.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0);
                        app.put("isUser", (appInfo.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) == 0);
                        appList.put(app);
                    } catch (Exception e) {
                        // Skip this app
                    }
                }
                
                JSObject ret = new JSObject();
                ret.put("value", appList);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "List apps error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Accessibility Service (UI Automation)
    // ==========================================

    @PluginMethod
    public void accessibilityReadScreen(PluginCall call) {
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("text", "");
                    ret.put("error", "Accessibility service not enabled. Go to Settings > Accessibility > Qwen Code and enable it.");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSObject result = service.readScreen();
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("text", "");
                ret.put("error", "Accessibility error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilityClickText(PluginCall call) {
        String text = call.getString("text", "");
        boolean exactMatch = call.getBoolean("exactMatch", false);
        
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSObject result = service.clickText(text, exactMatch);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilityClickAt(PluginCall call) {
        int x = call.getInt("x", 0);
        int y = call.getInt("y", 0);
        
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSObject result = service.clickAt(x, y);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilityTypeText(PluginCall call) {
        String text = call.getString("text", "");
        
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSObject result = service.typeText(text);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilitySwipe(PluginCall call) {
        int startX = call.getInt("startX", 0);
        int startY = call.getInt("startY", 0);
        int endX = call.getInt("endX", 0);
        int endY = call.getInt("endY", 0);
        int duration = call.getInt("duration", 300);
        
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSObject result = service.swipe(startX, startY, endX, endY, duration);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilityPressBack(PluginCall call) {
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                JSObject result = service.pressBack();
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void accessibilityPressHome(PluginCall call) {
        new Thread(() -> {
            try {
                QwenAccessibilityService service = QwenAccessibilityService.getInstance();
                if (service == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Accessibility service not enabled");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                JSObject result = service.pressHome();
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Notifications
    // ==========================================

    @PluginMethod
    public void readNotifications(PluginCall call) {
        int limit = call.getInt("limit", 20);
        
        new Thread(() -> {
            try {
                QwenNotificationListener listener = QwenNotificationListener.getInstance();
                if (listener == null) {
                    JSObject ret = new JSObject();
                    ret.put("value", new JSArray());
                    ret.put("error", "Notification access not enabled. Go to Settings > Apps > Special App Access > Notification Access > Qwen Code and enable it.");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }
                
                JSArray notifications = listener.getActiveNotifications();
                JSObject ret = new JSObject();
                ret.put("value", notifications);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("value", new JSArray());
                ret.put("error", "Notification error: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    @PluginMethod
    public void dismissNotification(PluginCall call) {
        String key = call.getString("key", "");
        try {
            QwenNotificationListener listener = QwenNotificationListener.getInstance();
            if (listener == null) {
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Notification access not enabled");
                call.resolve(ret);
                return;
            }
            boolean dismissed = listener.dismissNotification(key);
            JSObject ret = new JSObject();
            ret.put("value", dismissed);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }

    // ==========================================
    // Clipboard
    // ==========================================

    @PluginMethod
    public void clipboardWrite(PluginCall call) {
        String text = call.getString("text", "");
        try {
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) 
                getActivity().getSystemService(Context.CLIPBOARD_SERVICE);
            android.content.ClipData clip = android.content.ClipData.newPlainText("text", text);
            clipboard.setPrimaryClip(clip);
            
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void clipboardRead(PluginCall call) {
        try {
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) 
                getActivity().getSystemService(Context.CLIPBOARD_SERVICE);
            
            String text = "";
            if (clipboard.hasPrimaryClip()) {
                android.content.ClipData clip = clipboard.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence clipText = clip.getItemAt(0).getText();
                    if (clipText != null) {
                        text = clipText.toString();
                    }
                }
            }
            
            JSObject ret = new JSObject();
            ret.put("value", text);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", "");
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // ==========================================
    // Toast / Message
    // ==========================================

    @PluginMethod
    public void showToast(PluginCall call) {
        String message = call.getString("message", "");
        try {
            new Handler(Looper.getMainLooper()).post(() -> {
                Toast.makeText(getActivity(), message, Toast.LENGTH_SHORT).show();
            });
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }

    // ==========================================
    // Device Info
    // ==========================================

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("brand", Build.BRAND);
            ret.put("device", Build.DEVICE);
            ret.put("androidVersion", Build.VERSION.RELEASE);
            ret.put("sdkVersion", Build.VERSION.SDK_INT);
            ret.put("fingerprint", Build.FINGERPRINT);
            ret.put("totalStorage", Environment.getExternalStorageDirectory().getTotalSpace());
            ret.put("freeStorage", Environment.getExternalStorageDirectory().getUsableSpace());
            ret.put("isRooted", checkRootAccess());
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
    
    private boolean checkRootAccess() {
        try {
            String[] paths = {"/system/app/Superuser.apk", "/sbin/su", "/system/bin/su", 
                            "/system/xbin/su", "/data/local/xbin/su", "/data/local/bin/su"};
            for (String path : paths) {
                if (new File(path).exists()) return true;
            }
            Process process = Runtime.getRuntime().exec("which su");
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();
            reader.close();
            return line != null && !line.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    // ==========================================
    // Path Resolution
    // ==========================================

    private File resolvePath(String path) {
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
