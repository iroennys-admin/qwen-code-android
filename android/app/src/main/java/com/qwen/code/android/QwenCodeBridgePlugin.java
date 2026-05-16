package com.qwen.code.android;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

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
import java.io.OutputStreamWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(
    name = "QwenCodeBridge",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE",
                "android.permission.MANAGE_EXTERNAL_STORAGE"
            }
        )
    }
)
public class QwenCodeBridgePlugin extends Plugin {
    
    private static final String TAG = "QwenCodeBridge";
    private String workingDir;
    
    @Override
    public void load() {
        workingDir = getActivity().getFilesDir().getAbsolutePath();
    }
    
    @PluginMethod
    public void isCapacitor(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void executeShell(PluginCall call) {
        String command = call.getString("command", "");
        int timeout = call.getInt("timeout", 30);
        
        if (command.isEmpty()) {
            call.reject("Command is required");
            return;
        }
        
        new Thread(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder("sh", "-c", command);
                pb.directory(new File(workingDir));
                pb.redirectErrorStream(false);
                
                Process process = pb.start();
                
                // Read stdout
                BufferedReader stdoutReader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder stdout = new StringBuilder();
                String line;
                while ((line = stdoutReader.readLine()) != null) {
                    stdout.append(line).append("\n");
                }
                
                // Read stderr
                BufferedReader stderrReader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream()));
                StringBuilder stderr = new StringBuilder();
                while ((line = stderrReader.readLine()) != null) {
                    stderr.append(line).append("\n");
                }
                
                boolean completed = process.waitFor(timeout, java.util.concurrent.TimeUnit.SECONDS);
                int exitCode = completed ? process.exitValue() : -1;
                
                if (!completed) {
                    process.destroyForcibly();
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
                if (!file.exists() || !file.isFile()) {
                    new Handler(Looper.getMainLooper()).post(() -> call.reject("File not found: " + path));
                    return;
                }
                
                BufferedReader reader = new BufferedReader(new FileReader(file));
                StringBuilder content = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    content.append(line).append("\n");
                }
                reader.close();
                
                JSObject ret = new JSObject();
                ret.put("value", content.toString());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() -> call.reject("Read error: " + e.getMessage()));
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
                file.getParentFile().mkdirs();
                
                FileOutputStream fos = new FileOutputStream(file);
                OutputStreamWriter writer = new OutputStreamWriter(fos);
                writer.write(content);
                writer.close();
                fos.close();
                
                JSObject ret = new JSObject();
                ret.put("value", true);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() -> call.reject("Write error: " + e.getMessage()));
            }
        }).start();
    }
    
    @PluginMethod
    public void listDir(PluginCall call) {
        String path = call.getString("path", "");
        
        new Thread(() -> {
            try {
                File dir = resolvePath(path.isEmpty() ? workingDir : path);
                if (!dir.exists() || !dir.isDirectory()) {
                    new Handler(Looper.getMainLooper()).post(() -> call.reject("Directory not found: " + path));
                    return;
                }
                
                File[] files = dir.listFiles();
                List<String> names = new ArrayList<>();
                if (files != null) {
                    Arrays.sort(files, (a, b) -> {
                        if (a.isDirectory() != b.isDirectory()) return a.isDirectory() ? -1 : 1;
                        return a.getName().compareToIgnoreCase(b.getName());
                    });
                    for (File f : files) {
                        names.add(f.getName());
                    }
                }
                
                JSObject ret = new JSObject();
                ret.put("value", names);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() -> call.reject("List error: " + e.getMessage()));
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
        
        try {
            File file = resolvePath(path);
            boolean deleted = file.delete();
            JSObject ret = new JSObject();
            ret.put("value", deleted);
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
        ret.put("value", getActivity().getFilesDir().getAbsolutePath());
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
                call.reject("Not a directory: " + dir);
            }
        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }
    
    private File resolvePath(String path) {
        File file = new File(path);
        if (!file.isAbsolute()) {
            file = new File(workingDir, path);
        }
        return file;
    }
}
