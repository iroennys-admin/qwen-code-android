package com.opencode.android;

import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * OpenCodeBridgePlugin - Capacitor plugin for running OpenCode inside a proot Ubuntu environment.
 *
 * This plugin manages:
 * - Proot binary setup and verification
 * - Ubuntu rootfs download and extraction
 * - OpenCode installation inside the proot environment
 * - Interactive PTY sessions running OpenCode
 * - Single command execution inside proot
 *
 * The proot approach provides a chroot-like environment without requiring root access,
 * allowing us to run a full Linux distribution (Ubuntu) and OpenCode on any Android device.
 */
@CapacitorPlugin(name = "OpenCodeProot")
public class OpenCodeProotPlugin extends Plugin {

    private static final String TAG = "OpenCodeProot";

    // Paths relative to app files directory
    private String filesDir;
    private String prootPath;
    private String ubuntuRootPath;
    private String opencodeBinPath;

    // Session management
    private final ConcurrentHashMap<String, ProcessSession> activeSessions = new ConcurrentHashMap<>();
    private final AtomicInteger sessionCounter = new AtomicInteger(0);

    // Architecture detection
    private String deviceArch;

    /**
     * Inner class to hold session data for interactive proot sessions.
     */
    private static class ProcessSession {
        String sessionId;
        Process process;
        OutputStream stdin;
        Thread stdoutThread;
        Thread stderrThread;
        volatile boolean running = true;
        OpenCodeProotPlugin plugin;

        void destroy() {
            running = false;
            try {
                if (stdin != null) stdin.close();
            } catch (Exception ignored) {}
            if (process != null) {
                process.destroyForcibly();
            }
            // Notify JS that the session ended
            if (plugin != null) {
                JSObject data = new JSObject();
                data.put("sessionId", sessionId);
                data.put("type", "exit");
                plugin.sendEvent("opencode-output", data);
            }
        }
    }

    // Public wrapper for protected notifyListeners
    public void sendEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    @Override
    public void load() {
        filesDir = getContext().getFilesDir().getAbsolutePath();
        prootPath = filesDir + "/usr/bin/proot";
        ubuntuRootPath = filesDir + "/ubuntu";
        opencodeBinPath = ubuntuRootPath + "/root/.opencode/bin/opencode";
        deviceArch = detectArchitecture();
        Log.i(TAG, "OpenCodeBridge loaded. Arch: " + deviceArch + ", filesDir: " + filesDir);
    }

    // ==========================================
    // Architecture Detection
    // ==========================================

    /**
     * Detect the device's CPU architecture for downloading the correct binaries.
     */
    private String detectArchitecture() {
        String abi = Build.SUPPORTED_ABIS[0];
        switch (abi) {
            case "arm64-v8a":
                return "arm64";
            case "armeabi-v7a":
            case "armeabi":
                return "arm";
            case "x86_64":
                return "x86_64";
            case "x86":
                return "x86";
            default:
                Log.w(TAG, "Unknown ABI: " + abi + ", defaulting to arm64");
                return "arm64";
        }
    }

    /**
     * Map device architecture to Ubuntu architecture naming.
     */
    private String getUbuntuArch() {
        switch (deviceArch) {
            case "arm64":
                return "arm64";
            case "arm":
                return "armhf";
            case "x86_64":
                return "amd64";
            case "x86":
                return "i386";
            default:
                return "arm64";
        }
    }

    // ==========================================
    // Check Setup Status
    // ==========================================

    /**
     * Check if proot, Ubuntu rootfs, and OpenCode are installed.
     * Returns status information about each component.
     */
    @PluginMethod
    public void checkSetup(PluginCall call) {
        boolean prootInstalled = new File(prootPath).exists() && new File(prootPath).canExecute();
        boolean ubuntuInstalled = new File(ubuntuRootPath + "/bin/bash").exists();
        boolean opencodeInstalled = new File(opencodeBinPath).exists();

        String setupStatus;
        if (prootInstalled && ubuntuInstalled && opencodeInstalled) {
            setupStatus = "ready";
        } else if (prootInstalled && ubuntuInstalled) {
            setupStatus = "needs-opencode";
        } else if (prootInstalled) {
            setupStatus = "needs-ubuntu";
        } else {
            setupStatus = "needs-setup";
        }

        JSObject ret = new JSObject();
        ret.put("setupStatus", setupStatus);
        ret.put("prootInstalled", prootInstalled);
        ret.put("ubuntuInstalled", ubuntuInstalled);
        ret.put("opencodeInstalled", opencodeInstalled);
        ret.put("prootPath", prootInstalled ? prootPath : "");
        ret.put("ubuntuRootPath", ubuntuInstalled ? ubuntuRootPath : "");
        ret.put("opencodeBinPath", opencodeInstalled ? opencodeBinPath : "");
        ret.put("architecture", deviceArch);
        call.resolve(ret);
    }

    // ==========================================
    // Setup Proot
    // ==========================================

    /**
     * Download and install the proot binary for the device architecture.
     * Creates the necessary directory structure.
     */
    @PluginMethod
    public void setupProot(PluginCall call) {
        new Thread(() -> {
            try {
                // Check if already installed
                if (new File(prootPath).exists() && new File(prootPath).canExecute()) {
                    JSObject ret = new JSObject();
                    ret.put("value", true);
                    ret.put("message", "Proot already installed");
                    ret.put("prootPath", prootPath);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                emitProgress("proot", "Creating directory structure...", 10);

                // Create directory structure
                File usrBin = new File(filesDir + "/usr/bin");
                File usrLib = new File(filesDir + "/usr/lib");
                File ubuntuDir = new File(ubuntuRootPath);
                if (!usrBin.exists()) usrBin.mkdirs();
                if (!usrLib.exists()) usrLib.mkdirs();
                if (!ubuntuDir.exists()) ubuntuDir.mkdirs();

                emitProgress("proot", "Downloading proot binary for " + deviceArch + "...", 30);

                // Try downloading proot from multiple sources
                // proot binaries come as tar.gz archives (e.g., root/bin/proot)
                boolean downloaded = false;
                String[] prootUrls = getProotDownloadUrls();
                String prootTarPath = filesDir + "/proot-download.tar.gz";

                for (String url : prootUrls) {
                    try {
                        emitProgress("proot", "Trying download from " + url + "...", 40);
                        downloadFile(url, prootTarPath);
                        downloaded = true;
                        break;
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to download proot from " + url + ": " + e.getMessage());
                    }
                }

                // Extract proot from the downloaded tar.gz archive
                if (downloaded) {
                    emitProgress("proot", "Extracting proot from archive...", 60);
                    downloaded = extractProotFromArchive(prootTarPath);
                    // Clean up downloaded tarball
                    new File(prootTarPath).delete();
                }

                // If download/extract failed, try extracting from assets
                if (!downloaded) {
                    emitProgress("proot", "Trying bundled proot from assets...", 70);
                    downloaded = extractProotFromAssets();
                }

                if (!downloaded) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Failed to download proot binary. Check internet connection.");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                emitProgress("proot", "Making proot executable...", 80);

                // Make proot executable
                File prootFile = new File(prootPath);
                if (!prootFile.setExecutable(true, false)) {
                    // Fallback: use chmod
                    Runtime rt = Runtime.getRuntime();
                    Process chmodProc = rt.exec(new String[]{"chmod", "755", prootPath});
                    chmodProc.waitFor();
                }

                emitProgress("proot", "Verifying proot installation...", 90);

                // Verify proot works
                boolean verified = verifyProot();

                if (!verified) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Proot binary installed but verification failed");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                emitProgress("proot", "Proot setup complete!", 100);

                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("message", "Proot installed successfully");
                ret.put("prootPath", prootPath);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "Error setting up proot: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Proot setup failed: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    /**
     * Get download URLs for the proot binary, ordered by reliability.
     *
     * Sources for Android-compatible proot binaries:
     * 1. green-green-avk/build-proot-android - statically linked, relocatable, best for Android
     *    Provides: proot-android-armv7a.tar.gz (32-bit), proot-android-aarch64.tar.gz (64-bit)
     * 2. Bundled in APK assets as fallback
     *
     * NOTE: The nicm/proot GitHub releases do NOT contain Android-specific binaries.
     * Bintray is defunct. Do NOT use those URLs.
     *
     * For 32-bit ARM (armeabi-v7a), the green-green-avk binary is the only reliable
     * pre-built option. It must be compiled with -marm (not -mthumb) to avoid the
     * r7 register conflict segfault (see termux/proot issue #1).
     */
    private String[] getProotDownloadUrls() {
        String prootArch = getProotArch();
        return new String[]{
            // green-green-avk: Android-specific builds, statically linked with libtalloc
            // Archives contain root/bin/proot and root/bin/proot-userland
            "https://github.com/green-green-avk/build-proot-android/raw/master/packages/proot-android-" + prootArch + ".tar.gz",
            // skirsten: CI-built portable proot binaries based on Termux proot package
            "https://github.com/skirsten/proot-portable-android-binaries/releases/latest/download/proot-" + prootArch + ".tar.gz",
        };
    }

    /**
     * Map device architecture to proot binary architecture naming.
     * green-green-avk uses: armv7a, aarch64, i686, x86_64
     */
    private String getProotArch() {
        switch (deviceArch) {
            case "arm64":
                return "aarch64";
            case "arm":
                return "armv7a";  // 32-bit ARM with hard-float
            case "x86_64":
                return "x86_64";
            case "x86":
                return "i686";
            default:
                return "aarch64";
        }
    }

    /**
     * Try to extract proot binary from APK assets.
     */
    private boolean extractProotFromAssets() {
        try {
            String assetName = "opencode/proot-" + deviceArch;
            InputStream is = getContext().getAssets().open(assetName);
            FileOutputStream fos = new FileOutputStream(prootPath);
            byte[] buffer = new byte[8192];
            int len;
            while ((len = is.read(buffer)) != -1) {
                fos.write(buffer, 0, len);
            }
            fos.flush();
            fos.close();
            is.close();
            return true;
        } catch (IOException e) {
            Log.w(TAG, "No bundled proot in assets: " + e.getMessage());
            return false;
        }
    }

    /**
     * Extract proot binary from a downloaded tar.gz archive.
     *
     * green-green-avk archives contain: root/bin/proot, root/bin/proot-userland
     * skirsten archives contain: proot (at top level or in bin/)
     *
     * This method searches for the proot binary in the archive and extracts it
     * to the expected prootPath location.
     */
    private boolean extractProotFromArchive(String archivePath) {
        try {
            // First, list the archive contents to find the proot binary
            ProcessBuilder listPb = new ProcessBuilder("tar", "-tzf", archivePath);
            listPb.redirectErrorStream(true);
            Process listProc = listPb.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(listProc.getInputStream()));
            String prootEntry = null;
            String line;
            while ((line = reader.readLine()) != null) {
                // Look for the proot binary (not proot-userland)
                String trimmed = line.trim();
                if ((trimmed.endsWith("/proot") || trimmed.equals("proot"))
                        && !trimmed.contains("proot-userland")) {
                    prootEntry = trimmed;
                    // Prefer root/bin/proot or bin/proot over top-level
                    if (trimmed.endsWith("bin/proot")) {
                        break;
                    }
                }
            }
            listProc.waitFor();

            if (prootEntry == null) {
                Log.e(TAG, "Could not find proot binary in archive");
                return false;
            }

            Log.i(TAG, "Found proot binary in archive: " + prootEntry);

            // Extract just the proot binary
            ProcessBuilder extractPb = new ProcessBuilder(
                "tar", "-xzf", archivePath,
                "-C", filesDir,
                "--strip-components=" + countPathComponents(prootEntry),
                prootEntry
            );
            extractPb.redirectErrorStream(true);
            Process extractProc = extractPb.start();
            boolean completed = extractProc.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);
            if (!completed) {
                extractProc.destroyForcibly();
                return false;
            }
            if (extractProc.exitValue() != 0) {
                Log.e(TAG, "tar extract failed with exit code: " + extractProc.exitValue());
                // Fallback: extract entire archive and copy proot binary
                return extractProotFromArchiveFallback(archivePath, prootEntry);
            }

            // The extracted file may be at filesDir/proot, move it to prootPath
            File extractedFile = new File(filesDir, "proot");
            File targetFile = new File(prootPath);
            if (extractedFile.exists() && !extractedFile.getAbsolutePath().equals(targetFile.getAbsolutePath())) {
                // Ensure parent directory exists
                targetFile.getParentFile().mkdirs();
                extractedFile.renameTo(targetFile);
            }

            return targetFile.exists();
        } catch (Exception e) {
            Log.e(TAG, "Error extracting proot from archive: " + e.getMessage());
            return false;
        }
    }

    /**
     * Fallback: extract entire archive and find/copy the proot binary.
     */
    private boolean extractProotFromArchiveFallback(String archivePath, String prootEntry) {
        try {
            File tempDir = new File(filesDir + "/proot-temp");
            if (tempDir.exists()) {
                deleteRecursive(tempDir);
            }
            tempDir.mkdirs();

            ProcessBuilder extractPb = new ProcessBuilder(
                "tar", "-xzf", archivePath, "-C", tempDir.getAbsolutePath()
            );
            extractPb.redirectErrorStream(true);
            Process extractProc = extractPb.start();
            boolean completed = extractProc.waitFor(60, java.util.concurrent.TimeUnit.SECONDS);
            if (!completed) {
                extractProc.destroyForcibly();
                return false;
            }

            // Find and copy the proot binary
            File prootFile = findFile(tempDir, "proot");
            if (prootFile == null) {
                Log.e(TAG, "Could not find proot binary in extracted archive");
                deleteRecursive(tempDir);
                return false;
            }

            // Copy to prootPath
            File targetFile = new File(prootPath);
            targetFile.getParentFile().mkdirs();
            copyFile(prootFile, targetFile);

            // Cleanup temp directory
            deleteRecursive(tempDir);
            return targetFile.exists();
        } catch (Exception e) {
            Log.e(TAG, "Fallback extraction failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * Count the number of path components (for --strip-components).
     */
    private int countPathComponents(String path) {
        if (path == null || path.isEmpty()) return 0;
        // Remove trailing slashes
        String normalized = path.replaceAll("/+$", "");
        if (normalized.isEmpty()) return 0;
        return normalized.split("/").length - 1;
    }

    /**
     * Recursively find a file by name in a directory tree.
     */
    private File findFile(File dir, String name) {
        File[] files = dir.listFiles();
        if (files == null) return null;
        for (File f : files) {
            if (f.isDirectory()) {
                File found = findFile(f, name);
                if (found != null) return found;
            } else if (f.getName().equals(name)) {
                return f;
            }
        }
        return null;
    }

    /**
     * Copy a file from source to destination.
     */
    private void copyFile(File src, File dst) throws IOException {
        InputStream is = new java.io.FileInputStream(src);
        FileOutputStream fos = new FileOutputStream(dst);
        byte[] buffer = new byte[8192];
        int len;
        while ((len = is.read(buffer)) != -1) {
            fos.write(buffer, 0, len);
        }
        fos.flush();
        fos.close();
        is.close();
    }

    /**
     * Recursively delete a directory.
     */
    private void deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        file.delete();
    }

    /**
     * Verify that the proot binary works by running proot --version.
     */
    private boolean verifyProot() {
        try {
            ProcessBuilder pb = new ProcessBuilder(prootPath, "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean completed = process.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                return false;
            }
            int exitCode = process.exitValue();
            // proot --version may return 0 or 1, but should not crash
            return exitCode != 139; // SIGSEGV would indicate incompatible binary
        } catch (Exception e) {
            Log.e(TAG, "Proot verification failed: " + e.getMessage());
            return false;
        }
    }

    // ==========================================
    // Setup Ubuntu Rootfs
    // ==========================================

    /**
     * Download and extract Ubuntu rootfs for the device architecture.
     * Uses a minimal Ubuntu 24.04 (Noble) rootfs.
     */
    @PluginMethod
    public void setupUbuntu(PluginCall call) {
        new Thread(() -> {
            try {
                // Check if proot is installed
                if (!new File(prootPath).exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Proot must be installed first. Run setupProot().");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                // Check if Ubuntu is already installed
                if (new File(ubuntuRootPath + "/bin/bash").exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", true);
                    ret.put("message", "Ubuntu already installed");
                    ret.put("ubuntuRootPath", ubuntuRootPath);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                emitProgress("ubuntu", "Starting Ubuntu rootfs setup...", 5);

                // Ensure ubuntu directory exists
                File ubuntuDir = new File(ubuntuRootPath);
                if (!ubuntuDir.exists()) ubuntuDir.mkdirs();

                String ubuntuArch = getUbuntuArch();
                String tarballPath = filesDir + "/ubuntu-rootfs.tar.xz";

                // Download Ubuntu rootfs
                emitProgress("ubuntu", "Downloading Ubuntu rootfs (" + ubuntuArch + ")...", 10);

                String[] rootfsUrls = getUbuntuRootfsUrls(ubuntuArch);
                boolean downloaded = false;

                for (String url : rootfsUrls) {
                    try {
                        emitProgress("ubuntu", "Downloading from " + url + "...", 15);
                        downloadFileWithProgress(url, tarballPath, "ubuntu", 15, 60);
                        downloaded = true;
                        break;
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to download rootfs from " + url + ": " + e.getMessage());
                    }
                }

                if (!downloaded) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Failed to download Ubuntu rootfs. Check internet connection.");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                // Extract rootfs
                emitProgress("ubuntu", "Extracting Ubuntu rootfs (this may take a few minutes)...", 65);

                ProcessBuilder pb = new ProcessBuilder("tar", "-xJf", tarballPath, "-C", ubuntuRootPath);
                pb.redirectErrorStream(true);
                Process extractProcess = pb.start();

                // Read output in a separate thread to prevent blocking
                Thread readThread = new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(extractProcess.getInputStream()));
                        String line;
                        while ((line = reader.readLine()) != null) {
                            Log.d(TAG, "tar: " + line);
                        }
                    } catch (Exception ignored) {}
                });
                readThread.start();

                boolean completed = extractProcess.waitFor(600, java.util.concurrent.TimeUnit.SECONDS);
                readThread.join(5000);

                if (!completed) {
                    extractProcess.destroyForcibly();
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Ubuntu extraction timed out");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                int exitCode = extractProcess.exitValue();
                if (exitCode != 0) {
                    Log.e(TAG, "tar extraction failed with exit code: " + exitCode);
                    // Try with .tar.gz as fallback (some rootfs archives use gzip)
                    emitProgress("ubuntu", "Retrying extraction with gzip...", 65);
                    ProcessBuilder pb2 = new ProcessBuilder("tar", "-xzf", tarballPath, "-C", ubuntuRootPath);
                    pb2.redirectErrorStream(true);
                    Process extractProcess2 = pb2.start();
                    boolean completed2 = extractProcess2.waitFor(600, java.util.concurrent.TimeUnit.SECONDS);
                    if (!completed2 || extractProcess2.exitValue() != 0) {
                        JSObject ret = new JSObject();
                        ret.put("value", false);
                        ret.put("error", "Failed to extract Ubuntu rootfs (exit code: " + exitCode + ")");
                        new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                        return;
                    }
                }

                emitProgress("ubuntu", "Configuring Ubuntu environment...", 85);

                // Setup basic configuration
                setupUbuntuConfig();

                // Clean up tarball
                new File(tarballPath).delete();

                emitProgress("ubuntu", "Ubuntu setup complete!", 100);

                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("message", "Ubuntu rootfs installed successfully");
                ret.put("ubuntuRootPath", ubuntuRootPath);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "Error setting up Ubuntu: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Ubuntu setup failed: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    /**
     * Get download URLs for Ubuntu rootfs, ordered by reliability.
     *
     * IMPORTANT for armhf (32-bit ARM):
     * - Ubuntu 24.04 (Noble) cloud images DO have armhf rootfs tarballs
     * - Ubuntu 24.04 dropped Raspberry Pi 32-bit *desktop/server* images, but
     *   cloud-images.ubuntu.com still provides armhf root.tar.xz
     * - Ubuntu Base images (cdimage.ubuntu.com) also have armhf .tar.gz
     * - For 32-bit ARM, the cloud image rootfs is the recommended option
     *
     * Fallback: Ubuntu Base images from cdimage.ubuntu.com (these are .tar.gz,
     * not .tar.xz, and are even more minimal - just the base system without
     * cloud-init). The setupUbuntuConfig() method handles post-extraction setup.
     */
    private String[] getUbuntuRootfsUrls(String ubuntuArch) {
        if ("armhf".equals(ubuntuArch)) {
            return new String[]{
                // Ubuntu 22.04 LTS (Jammy) armhf - confirmed available, stable
                "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-armhf-root.tar.xz",
                // Ubuntu 24.04 LTS (Noble) armhf - confirmed available on cloud-images
                "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-armhf-root.tar.xz",
                // Ubuntu Base 22.04 armhf - very minimal, from cdimage.ubuntu.com (.tar.gz)
                "https://cdimage.ubuntu.com/ubuntu-base/releases/22.04/release/ubuntu-base-22.04.5-base-armhf.tar.gz",
                // Ubuntu Base 24.04 armhf - very minimal (.tar.gz)
                "https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/ubuntu-base-24.04.4-base-armhf.tar.gz",
                // Anlinux pre-built Ubuntu armhf rootfs
                "https://github.com/EXALAB/Anlinux-Resources/raw/master/Rootfs/Ubuntu/armhf/ubuntu-rootfs-armhf.tar.xz",
            };
        }
        // For arm64, amd64, i386
        return new String[]{
            "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-" + ubuntuArch + "-root.tar.xz",
            "https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-" + ubuntuArch + "-root.tar.xz",
        };
    }

    /**
     * Setup basic Ubuntu configuration inside the rootfs.
     */
    private void setupUbuntuConfig() {
        try {
            // Create resolv.conf for DNS resolution
            File resolvConf = new File(ubuntuRootPath + "/etc/resolv.conf");
            if (resolvConf.getParentFile() != null && !resolvConf.getParentFile().exists()) {
                resolvConf.getParentFile().mkdirs();
            }
            FileOutputStream fos = new FileOutputStream(resolvConf);
            fos.write("nameserver 8.8.8.8\nnameserver 8.8.4.4\nnameserver 1.1.1.1\n".getBytes());
            fos.close();

            // Create /etc/hostname
            File hostname = new File(ubuntuRootPath + "/etc/hostname");
            fos = new FileOutputStream(hostname);
            fos.write("localhost\n".getBytes());
            fos.close();

            // Create /etc/hosts
            File hosts = new File(ubuntuRootPath + "/etc/hosts");
            fos = new FileOutputStream(hosts);
            fos.write("127.0.0.1\tlocalhost\n127.0.0.1\tlocalhost.localdomain\n".getBytes());
            fos.close();

            // Setup /tmp directory
            File tmp = new File(ubuntuRootPath + "/tmp");
            if (!tmp.exists()) tmp.mkdirs();
            tmp.setWritable(true, false);
            tmp.setReadable(true, false);
            tmp.setExecutable(true, false);

            // Setup /root directory
            File root = new File(ubuntuRootPath + "/root");
            if (!root.exists()) root.mkdirs();

            // Create /run directory
            File run = new File(ubuntuRootPath + "/run");
            if (!run.exists()) run.mkdirs();
            run.setWritable(true, false);

            // Create /dev/null if it doesn't exist (proot will bind /dev)
            File dev = new File(ubuntuRootPath + "/dev");
            if (!dev.exists()) dev.mkdirs();

            // Setup basic bashrc
            File bashrc = new File(ubuntuRootPath + "/root/.bashrc");
            if (!bashrc.exists()) {
                fos = new FileOutputStream(bashrc);
                fos.write(("# ~/.bashrc\n"
                    + "export LANG=en_US.UTF-8\n"
                    + "export TERM=xterm-256color\n"
                    + "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n"
                    + "export HOME=/root\n"
                    + "PS1='\\u@ubuntu:\\w\\$ '\n").getBytes());
                fos.close();
            }

            Log.i(TAG, "Ubuntu basic configuration complete");
        } catch (Exception e) {
            Log.e(TAG, "Error configuring Ubuntu: " + e.getMessage());
        }
    }

    // ==========================================
    // Install OpenCode
    // ==========================================

    /**
     * Install OpenCode inside the proot Ubuntu environment.
     * Installs curl and ca-certificates first, then runs the OpenCode installer.
     */
    @PluginMethod
    public void installOpenCode(PluginCall call) {
        new Thread(() -> {
            try {
                // Check prerequisites
                if (!new File(prootPath).exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Proot must be installed first");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                if (!new File(ubuntuRootPath + "/bin/bash").exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Ubuntu must be installed first");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                // Check if already installed
                if (new File(opencodeBinPath).exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", true);
                    ret.put("message", "OpenCode already installed");
                    ret.put("opencodeBinPath", opencodeBinPath);
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                emitProgress("opencode", "Installing essential packages (curl, ca-certificates)...", 10);

                // Install curl and ca-certificates inside Ubuntu
                String aptCommand = "apt-get update -y && apt-get install -y curl ca-certificates locales";
                int aptResult = executeProotCommandInternal(aptCommand, 300);

                if (aptResult != 0) {
                    Log.w(TAG, "apt-get install returned " + aptResult + ", continuing anyway...");
                    // Don't fail here - curl might already be installed
                }

                // Setup locale
                emitProgress("opencode", "Setting up locale...", 30);
                String localeCommand = "locale-gen en_US.UTF-8 && echo 'export LANG=en_US.UTF-8' >> /root/.bashrc";
                executeProotCommandInternal(localeCommand, 60);

                // Install OpenCode
                emitProgress("opencode", "Downloading and installing OpenCode...", 40);

                String installCommand = "export SHELL=/bin/bash && export TMPDIR=/tmp && export HOME=/root "
                    + "&& export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin "
                    + "&& curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path";

                int installResult = executeProotCommandInternalWithOutput(installCommand, 600, "opencode");

                if (installResult != 0) {
                    Log.w(TAG, "OpenCode installer returned " + installResult);
                }

                emitProgress("opencode", "Verifying OpenCode installation...", 90);

                // Verify installation
                if (!new File(opencodeBinPath).exists()) {
                    // Try alternate path
                    String altPath = ubuntuRootPath + "/usr/local/bin/opencode";
                    if (new File(altPath).exists()) {
                        opencodeBinPath = altPath;
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("value", false);
                        ret.put("error", "OpenCode binary not found after installation. The installer may have failed.");
                        new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                        return;
                    }
                }

                // Add opencode to PATH in bashrc
                File bashrc = new File(ubuntuRootPath + "/root/.bashrc");
                if (bashrc.exists()) {
                    try {
                        BufferedReader reader = new BufferedReader(new java.io.FileReader(bashrc));
                        StringBuilder content = new StringBuilder();
                        String line;
                        boolean hasOpenCodePath = false;
                        while ((line = reader.readLine()) != null) {
                            content.append(line).append("\n");
                            if (line.contains(".opencode/bin")) hasOpenCodePath = true;
                        }
                        reader.close();

                        if (!hasOpenCodePath) {
                            FileOutputStream fos = new FileOutputStream(bashrc, true);
                            fos.write("\n# opencode\nexport PATH=/root/.opencode/bin:$PATH\n".getBytes());
                            fos.close();
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to update bashrc: " + e.getMessage());
                    }
                }

                // Create wrapper script at {filesDir}/usr/bin/opencode
                createOpenCodeWrapperScript();

                emitProgress("opencode", "OpenCode installed successfully!", 100);

                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("message", "OpenCode installed successfully");
                ret.put("opencodeBinPath", opencodeBinPath);
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "Error installing OpenCode: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "OpenCode installation failed: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    /**
     * Create a wrapper script that launches OpenCode inside proot.
     */
    private void createOpenCodeWrapperScript() {
        try {
            String wrapperPath = filesDir + "/usr/bin/opencode";
            FileOutputStream fos = new FileOutputStream(wrapperPath);
            String script = "#!/bin/sh\n"
                + "# OpenCode wrapper script - launches OpenCode inside proot Ubuntu\n"
                + "# Supports 32-bit ARM (armhf) and 64-bit ARM (arm64) devices\n"
                + "PROOT=\"" + prootPath + "\"\n"
                + "UBUNTU_ROOTFS=\"" + ubuntuRootPath + "\"\n"
                + "WORKDIR=\"${1:-/root}\"\n"
                + "\n"
                + "# Forward API keys\n"
                + "ENV_ARGS=\"\"\n"
                + "for var in OPENAI_API_KEY ANTHROPIC_API_KEY OPENCODE_API_KEY GEMINI_API_KEY; do\n"
                + "    val=$(printenv $var 2>/dev/null)\n"
                + "    if [ -n \"$val\" ]; then\n"
                + "        ENV_ARGS=\"$ENV_ARGS --env $var=$val\"\n"
                + "    fi\n"
                + "done\n"
                + "\n"
                + "# IMPORTANT: Unset LD_PRELOAD before running proot\n"
                + "# On Android, LD_PRELOAD may be set by the system and will cause\n"
                + "# proot to crash with 'loader not found' errors\n"
                + "unset LD_PRELOAD\n"
                + "\n"
                + "# For Android 15+ with strict seccomp filters, proot needs\n"
                + "# PROOT_NO_SECCOMP=1 to bypass seccomp restrictions on ptrace.\n"
                + "# Android 15+ blocks certain ptrace operations that proot\n"
                + "# relies on for syscall interception.\n"
                + "export PROOT_NO_SECCOMP=1\n"
                + "\n"
                + "# On 32-bit ARM, use a lower LOADER_ADDRESS to avoid memory conflicts\n"
                + "# See: https://github.com/termux/termux-packages/issues/189\n"
                + "if [ \"$(uname -m)\" = \"armv7l\" ] || [ \"$(uname -m)\" = \"armhf\" ]; then\n"
                + "    export PROOT_LOADER_ADDRESS=0x20000000\n"
                + "fi\n"
                + "\n"
                + "exec $PROOT -0 \\\n"
                + "    -r $UBUNTU_ROOTFS \\\n"
                + "    -b /dev \\\n"
                + "    -b /proc \\\n"
                + "    -b /sys \\\n"
                + "    -b /sdcard /sdcard \\\n"
                + "    -b $UBUNTU_ROOTFS/root/.opencode:/root/.opencode \\\n"
                + "    $ENV_ARGS \\\n"
                + "    --env TERM=xterm-256color \\\n"
                + "    --env HOME=/root \\\n"
                + "    --env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.opencode/bin \\\n"
                + "    --env SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \\\n"
                + "    --env PROOT_NO_SECCOMP=1 \\\n"
                + "    -w /root \\\n"
                + "    /bin/bash -c '/root/.opencode/bin/opencode \"$@\"' _ \"$@\"\n";
            fos.write(script.getBytes());
            fos.close();

            // Make executable
            File wrapper = new File(wrapperPath);
            wrapper.setExecutable(true, false);
            Runtime.getRuntime().exec(new String[]{"chmod", "755", wrapperPath}).waitFor();

            Log.i(TAG, "OpenCode wrapper script created at " + wrapperPath);
        } catch (Exception e) {
            Log.e(TAG, "Failed to create wrapper script: " + e.getMessage());
        }
    }

    // ==========================================
    // Full Setup
    // ==========================================

    /**
     * Run the full setup sequence: setupProot → setupUbuntu → installOpenCode.
     * Reports progress via Capacitor events.
     */
    @PluginMethod
    public void fullSetup(PluginCall call) {
        new Thread(() -> {
            try {
                boolean success = true;
                String error = "";

                // Step 1: Setup proot
                if (!new File(prootPath).exists() || !new File(prootPath).canExecute()) {
                    emitProgress("full-setup", "Step 1/3: Setting up proot...", 5);

                    // Try downloading proot
                    String[] prootUrls = getProotDownloadUrls();
                    boolean prootDownloaded = false;

                    for (String url : prootUrls) {
                        try {
                            downloadFile(url, prootPath);
                            prootDownloaded = true;
                            break;
                        } catch (Exception e) {
                            Log.w(TAG, "Proot download failed from " + url);
                        }
                    }

                    if (!prootDownloaded) {
                        prootDownloaded = extractProotFromAssets();
                    }

                    if (prootDownloaded) {
                        File prootFile = new File(prootPath);
                        prootFile.setExecutable(true, false);
                        Runtime.getRuntime().exec(new String[]{"chmod", "755", prootPath}).waitFor();
                    } else {
                        success = false;
                        error = "Failed to install proot binary";
                    }
                } else {
                    emitProgress("full-setup", "Step 1/3: Proot already installed", 15);
                }

                // Step 2: Setup Ubuntu
                if (success && !new File(ubuntuRootPath + "/bin/bash").exists()) {
                    emitProgress("full-setup", "Step 2/3: Downloading Ubuntu rootfs...", 20);

                    String ubuntuArch = getUbuntuArch();
                    String tarballPath = filesDir + "/ubuntu-rootfs.tar.xz";
                    String[] rootfsUrls = getUbuntuRootfsUrls(ubuntuArch);
                    boolean rootfsDownloaded = false;

                    for (String url : rootfsUrls) {
                        try {
                            downloadFileWithProgress(url, tarballPath, "full-setup", 20, 50);
                            rootfsDownloaded = true;
                            break;
                        } catch (Exception e) {
                            Log.w(TAG, "Rootfs download failed from " + url);
                        }
                    }

                    if (rootfsDownloaded) {
                        emitProgress("full-setup", "Step 2/3: Extracting Ubuntu rootfs...", 55);

                        ProcessBuilder pb = new ProcessBuilder("tar", "-xJf", tarballPath, "-C", ubuntuRootPath);
                        pb.redirectErrorStream(true);
                        Process extractProcess = pb.start();

                        // Consume output
                        Thread readThread = new Thread(() -> {
                            try {
                                BufferedReader reader = new BufferedReader(new InputStreamReader(extractProcess.getInputStream()));
                                while (reader.readLine() != null) {}
                            } catch (Exception ignored) {}
                        });
                        readThread.start();

                        boolean completed = extractProcess.waitFor(600, java.util.concurrent.TimeUnit.SECONDS);
                        readThread.join(5000);

                        if (!completed) {
                            extractProcess.destroyForcibly();
                        }

                        new File(tarballPath).delete();
                        setupUbuntuConfig();

                        if (!completed || !new File(ubuntuRootPath + "/bin/bash").exists()) {
                            success = false;
                            error = "Failed to extract Ubuntu rootfs";
                        }
                    } else {
                        success = false;
                        error = "Failed to download Ubuntu rootfs";
                    }
                } else if (success) {
                    emitProgress("full-setup", "Step 2/3: Ubuntu already installed", 55);
                }

                // Step 3: Install OpenCode
                if (success && !new File(opencodeBinPath).exists()) {
                    emitProgress("full-setup", "Step 3/3: Installing OpenCode...", 60);

                    // Install essential packages
                    String aptCommand = "apt-get update -y && apt-get install -y curl ca-certificates locales";
                    executeProotCommandInternal(aptCommand, 300);

                    String localeCommand = "locale-gen en_US.UTF-8";
                    executeProotCommandInternal(localeCommand, 60);

                    // Install OpenCode
                    emitProgress("full-setup", "Step 3/3: Running OpenCode installer...", 70);
                    String installCommand = "export SHELL=/bin/bash && export TMPDIR=/tmp && export HOME=/root "
                        + "&& export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin "
                        + "&& curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path";
                    executeProotCommandInternalWithOutput(installCommand, 600, "full-setup");

                    if (!new File(opencodeBinPath).exists()) {
                        // Check alternate path
                        String altPath = ubuntuRootPath + "/usr/local/bin/opencode";
                        if (new File(altPath).exists()) {
                            opencodeBinPath = altPath;
                        } else {
                            success = false;
                            error = "OpenCode binary not found after installation";
                        }
                    }

                    if (success) {
                        createOpenCodeWrapperScript();
                    }
                } else if (success) {
                    emitProgress("full-setup", "Step 3/3: OpenCode already installed", 95);
                }

                if (success) {
                    emitProgress("full-setup", "Setup complete! OpenCode is ready to use.", 100);
                }

                JSObject ret = new JSObject();
                ret.put("value", success);
                if (!success) {
                    ret.put("error", error);
                } else {
                    ret.put("message", "OpenCode setup complete!");
                    ret.put("prootPath", prootPath);
                    ret.put("ubuntuRootPath", ubuntuRootPath);
                    ret.put("opencodeBinPath", opencodeBinPath);
                }
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "Full setup failed: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Full setup failed: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Start OpenCode Session (Interactive)
    // ==========================================

    /**
     * Start an interactive PTY session running OpenCode inside proot.
     * Terminal output is forwarded to JS via "opencode-output" events.
     * Input is sent via writeInput().
     */
    @PluginMethod
    public void startOpenCodeSession(PluginCall call) {
        String workdir = call.getString("workdir", "/root");

        new Thread(() -> {
            try {
                // Verify prerequisites
                if (!new File(prootPath).exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Proot not installed");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                if (!new File(ubuntuRootPath + "/bin/bash").exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "Ubuntu not installed");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                if (!new File(opencodeBinPath).exists()) {
                    JSObject ret = new JSObject();
                    ret.put("value", false);
                    ret.put("error", "OpenCode not installed");
                    new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
                    return;
                }

                String sessionId = "session-" + sessionCounter.incrementAndGet();

                // Build the proot command
                ProcessBuilder pb = new ProcessBuilder(
                    prootPath,
                    "-0",
                    "-r", ubuntuRootPath,
                    "-b", "/dev",
                    "-b", "/proc",
                    "-b", "/sys",
                    "-b", "/sdcard",
                    "/sdcard",
                    "-b", ubuntuRootPath + "/root/.opencode",
                    "/root/.opencode",
                    "-w", workdir,
                    "/bin/bash",
                    "-c",
                    "export TERM=xterm-256color; export HOME=/root; "
                        + "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.opencode/bin; "
                        + "export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt; "
                        + "/root/.opencode/bin/opencode"
                );

                // Set environment variables
                Map<String, String> env = pb.environment();
                env.remove("LD_PRELOAD"); // Must remove for proot

                // Forward API keys if available
                forwardEnvVar(env, "OPENAI_API_KEY");
                forwardEnvVar(env, "ANTHROPIC_API_KEY");
                forwardEnvVar(env, "OPENCODE_API_KEY");
                forwardEnvVar(env, "GEMINI_API_KEY");

                pb.redirectErrorStream(false);

                Process process = pb.start();

                ProcessSession session = new ProcessSession();
                session.sessionId = sessionId;
                session.process = process;
                session.stdin = process.getOutputStream();
                session.plugin = this;

                // Start stdout reader thread
                session.stdoutThread = new Thread(() -> {
                    try {
                        InputStream is = process.getInputStream();
                        byte[] buffer = new byte[4096];
                        int len;
                        while (session.running && (len = is.read(buffer)) != -1) {
                            String output = new String(buffer, 0, len);
                            JSObject data = new JSObject();
                            data.put("sessionId", sessionId);
                            data.put("type", "stdout");
                            data.put("data", output);
                            notifyListeners("opencode-output", data);
                        }
                    } catch (IOException e) {
                        if (session.running) {
                            Log.d(TAG, "stdout reader ended: " + e.getMessage());
                        }
                    } finally {
                        if (session.running) {
                            JSObject data = new JSObject();
                            data.put("sessionId", sessionId);
                            data.put("type", "stdout-end");
                            notifyListeners("opencode-output", data);
                        }
                    }
                }, "opencode-stdout-" + sessionId);
                session.stdoutThread.setDaemon(true);

                // Start stderr reader thread
                session.stderrThread = new Thread(() -> {
                    try {
                        InputStream is = process.getErrorStream();
                        byte[] buffer = new byte[4096];
                        int len;
                        while (session.running && (len = is.read(buffer)) != -1) {
                            String output = new String(buffer, 0, len);
                            JSObject data = new JSObject();
                            data.put("sessionId", sessionId);
                            data.put("type", "stderr");
                            data.put("data", output);
                            notifyListeners("opencode-output", data);
                        }
                    } catch (IOException e) {
                        if (session.running) {
                            Log.d(TAG, "stderr reader ended: " + e.getMessage());
                        }
                    }
                }, "opencode-stderr-" + sessionId);
                session.stderrThread.setDaemon(true);

                // Start a thread to monitor process exit
                Thread exitMonitor = new Thread(() -> {
                    try {
                        int exitCode = process.waitFor();
                        session.running = false;
                        JSObject data = new JSObject();
                        data.put("sessionId", sessionId);
                        data.put("type", "exit");
                        data.put("exitCode", exitCode);
                        notifyListeners("opencode-output", data);
                        activeSessions.remove(sessionId);
                    } catch (InterruptedException e) {
                        // Expected when session is killed
                    }
                }, "opencode-exit-" + sessionId);
                exitMonitor.setDaemon(true);

                session.stdoutThread.start();
                session.stderrThread.start();
                exitMonitor.start();

                activeSessions.put(sessionId, session);

                JSObject ret = new JSObject();
                ret.put("value", true);
                ret.put("sessionId", sessionId);
                ret.put("message", "OpenCode session started");
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));

            } catch (Exception e) {
                Log.e(TAG, "Error starting OpenCode session: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("value", false);
                ret.put("error", "Failed to start session: " + e.getMessage());
                new Handler(Looper.getMainLooper()).post(() -> call.resolve(ret));
            }
        }).start();
    }

    // ==========================================
    // Write Input to Session
    // ==========================================

    /**
     * Write data to the PTY session's stdin.
     * Used to send keyboard input to the running OpenCode process.
     */
    @PluginMethod
    public void writeInput(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        String data = call.getString("data", "");

        if (sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        ProcessSession session = activeSessions.get(sessionId);
        if (session == null || !session.running) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Session not found or not running");
            call.resolve(ret);
            return;
        }

        try {
            session.stdin.write(data.getBytes());
            session.stdin.flush();
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (IOException e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Failed to write to session: " + e.getMessage());
            call.resolve(ret);
        }
    }

    // ==========================================
    // Resize Terminal
    // ==========================================

    /**
     * Resize the terminal for the given session.
     * Note: With ProcessBuilder (not a true PTY), terminal resize is best-effort.
     * For proper PTY resize support, a native PTY implementation would be needed.
     */
    @PluginMethod
    public void resizeTerminal(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        int cols = call.getInt("cols", 80);
        int rows = call.getInt("rows", 24);

        if (sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        ProcessSession session = activeSessions.get(sessionId);
        if (session == null || !session.running) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Session not found or not running");
            call.resolve(ret);
            return;
        }

        // For a ProcessBuilder-based session, we can try to set COLUMNS and LINES
        // This won't affect the actual PTY size but may help some applications
        try {
            String resizeCmd = "export COLUMNS=" + cols + "; export LINES=" + rows + "\n";
            session.stdin.write(resizeCmd.getBytes());
            session.stdin.flush();

            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        } catch (IOException e) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Failed to resize: " + e.getMessage());
            call.resolve(ret);
        }
    }

    // ==========================================
    // Kill Session
    // ==========================================

    /**
     * Kill the running PTY session.
     */
    @PluginMethod
    public void killSession(PluginCall call) {
        String sessionId = call.getString("sessionId", "");

        if (sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        ProcessSession session = activeSessions.remove(sessionId);
        if (session == null) {
            JSObject ret = new JSObject();
            ret.put("value", false);
            ret.put("error", "Session not found");
            call.resolve(ret);
            return;
        }

        session.destroy();

        JSObject ret = new JSObject();
        ret.put("value", true);
        call.resolve(ret);
    }

    // ==========================================
    // Execute Single Proot Command
    // ==========================================

    /**
     * Execute a single command inside the proot Ubuntu environment.
     * Returns stdout, stderr, and exit code.
     */
    @PluginMethod
    public void executeProotCommand(PluginCall call) {
        String command = call.getString("command", "");
        int timeout = call.getInt("timeout", 60);

        if (command.isEmpty()) {
            call.reject("Command is required");
            return;
        }

        if (!new File(prootPath).exists()) {
            JSObject ret = new JSObject();
            ret.put("stdout", "");
            ret.put("stderr", "Proot not installed");
            ret.put("exitCode", -1);
            call.resolve(ret);
            return;
        }

        if (!new File(ubuntuRootPath + "/bin/bash").exists()) {
            JSObject ret = new JSObject();
            ret.put("stdout", "");
            ret.put("stderr", "Ubuntu not installed");
            ret.put("exitCode", -1);
            call.resolve(ret);
            return;
        }

        new Thread(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder(
                    prootPath,
                    "-0",
                    "-r", ubuntuRootPath,
                    "-b", "/dev",
                    "-b", "/proc",
                    "-b", "/sys",
                    "-w", "/root",
                    "/bin/bash", "-c", command
                );

                Map<String, String> env = pb.environment();
                env.remove("LD_PRELOAD");
                env.put("TERM", "xterm-256color");
                env.put("HOME", "/root");
                env.put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
                env.put("SSL_CERT_FILE", "/etc/ssl/certs/ca-certificates.crt");

                pb.redirectErrorStream(false);

                Process process = pb.start();

                StringBuilder stdout = new StringBuilder();
                StringBuilder stderr = new StringBuilder();

                Thread stdoutThread = new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                        char[] buffer = new char[4096];
                        int len;
                        while ((len = reader.read(buffer)) != -1) {
                            stdout.append(buffer, 0, len);
                        }
                    } catch (Exception ignored) {}
                });

                Thread stderrThread = new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
                        char[] buffer = new char[4096];
                        int len;
                        while ((len = reader.read(buffer)) != -1) {
                            stderr.append(buffer, 0, len);
                        }
                    } catch (Exception ignored) {}
                });

                stdoutThread.start();
                stderrThread.start();

                boolean completed = process.waitFor(timeout, java.util.concurrent.TimeUnit.SECONDS);

                stdoutThread.join(3000);
                stderrThread.join(3000);

                int exitCode;
                if (!completed) {
                    process.destroyForcibly();
                    exitCode = -1;
                } else {
                    exitCode = process.exitValue();
                }

                JSObject ret = new JSObject();
                ret.put("stdout", stdout.toString());
                ret.put("stderr", stderr.toString());
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
    // Helper Methods
    // ==========================================

    /**
     * Execute a proot command internally (not exposed as a plugin method).
     * Returns the exit code.
     */
    private int executeProotCommandInternal(String command, int timeoutSeconds) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                prootPath,
                "-0",
                "-r", ubuntuRootPath,
                "-b", "/dev",
                "-b", "/proc",
                "-b", "/sys",
                "-w", "/root",
                "/bin/bash", "-c", command
            );

            Map<String, String> env = pb.environment();
            env.remove("LD_PRELOAD");
            env.put("TERM", "xterm-256color");
            env.put("HOME", "/root");
            env.put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
            env.put("SSL_CERT_FILE", "/etc/ssl/certs/ca-certificates.crt");

            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Consume output to prevent blocking
            Thread readThread = new Thread(() -> {
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        Log.d(TAG, "proot-cmd: " + line);
                    }
                } catch (Exception ignored) {}
            });
            readThread.start();

            boolean completed = process.waitFor(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
            readThread.join(3000);

            if (!completed) {
                process.destroyForcibly();
                return -1;
            }

            return process.exitValue();
        } catch (Exception e) {
            Log.e(TAG, "Proot command execution failed: " + e.getMessage());
            return -1;
        }
    }

    /**
     * Execute a proot command internally with output forwarding to JS events.
     */
    private int executeProotCommandInternalWithOutput(String command, int timeoutSeconds, String progressId) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                prootPath,
                "-0",
                "-r", ubuntuRootPath,
                "-b", "/dev",
                "-b", "/proc",
                "-b", "/sys",
                "-w", "/root",
                "/bin/bash", "-c", command
            );

            Map<String, String> env = pb.environment();
            env.remove("LD_PRELOAD");
            env.put("TERM", "xterm-256color");
            env.put("HOME", "/root");
            env.put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
            env.put("SSL_CERT_FILE", "/etc/ssl/certs/ca-certificates.crt");

            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Read output and forward to JS
            Thread readThread = new Thread(() -> {
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        Log.d(TAG, "proot-cmd: " + line);
                        JSObject data = new JSObject();
                        data.put("phase", progressId);
                        data.put("message", line);
                        data.put("type", "log");
                        notifyListeners("opencode-setup-progress", data);
                    }
                } catch (Exception ignored) {}
            });
            readThread.start();

            boolean completed = process.waitFor(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
            readThread.join(3000);

            if (!completed) {
                process.destroyForcibly();
                return -1;
            }

            return process.exitValue();
        } catch (Exception e) {
            Log.e(TAG, "Proot command execution with output failed: " + e.getMessage());
            return -1;
        }
    }

    /**
     * Forward an environment variable from the Android process to the proot environment.
     */
    private void forwardEnvVar(Map<String, String> env, String varName) {
        String value = System.getenv(varName);
        if (value != null && !value.isEmpty()) {
            env.put(varName, value);
        }
    }

    /**
     * Download a file from a URL to a local path.
     */
    private void downloadFile(String urlStr, String destPath) throws IOException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(120000);
        conn.setInstanceFollowRedirects(true);

        try {
            int responseCode = conn.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + responseCode + " for " + urlStr);
            }

            InputStream is = conn.getInputStream();
            FileOutputStream fos = new FileOutputStream(destPath);
            byte[] buffer = new byte[8192];
            int len;
            while ((len = is.read(buffer)) != -1) {
                fos.write(buffer, 0, len);
            }
            fos.flush();
            fos.close();
            is.close();
        } finally {
            conn.disconnect();
        }
    }

    /**
     * Download a file from a URL with progress reporting.
     */
    private void downloadFileWithProgress(String urlStr, String destPath, String progressId,
                                           int startProgress, int endProgress) throws IOException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(300000); // 5 minute read timeout for large files
        conn.setInstanceFollowRedirects(true);

        try {
            int responseCode = conn.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + responseCode + " for " + urlStr);
            }

            int contentLength = conn.getContentLength();
            InputStream is = conn.getInputStream();
            FileOutputStream fos = new FileOutputStream(destPath);
            byte[] buffer = new byte[8192];
            long totalRead = 0;
            int lastReportedProgress = startProgress;
            int len;

            while ((len = is.read(buffer)) != -1) {
                fos.write(buffer, 0, len);
                totalRead += len;

                // Report progress periodically
                if (contentLength > 0) {
                    int progress = startProgress + (int) ((endProgress - startProgress) * totalRead / contentLength);
                    if (progress > lastReportedProgress + 5) {
                        String sizeInfo = formatFileSize(totalRead) + " / " + formatFileSize(contentLength);
                        emitProgress(progressId, "Downloading: " + sizeInfo, progress);
                        lastReportedProgress = progress;
                    }
                }
            }

            fos.flush();
            fos.close();
            is.close();
        } finally {
            conn.disconnect();
        }
    }

    /**
     * Format file size in human-readable format.
     */
    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    /**
     * Emit a setup progress event to JavaScript.
     */
    private void emitProgress(String phase, String message, int progress) {
        try {
            JSObject data = new JSObject();
            data.put("phase", phase);
            data.put("message", message);
            data.put("progress", progress);
            notifyListeners("opencode-setup-progress", data);
            Log.d(TAG, "[" + phase + "] " + progress + "% - " + message);
        } catch (Exception e) {
            Log.w(TAG, "Failed to emit progress: " + e.getMessage());
        }
    }
}
