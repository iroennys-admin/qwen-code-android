# Task: Complete Rewrite of Android App for OpenCode AI

## Summary
Successfully completed a full rewrite of the qwen-code-android Capacitor + React + Vite project to be focused 100% on OpenCode AI. The app is now called "OpenCode" and connects to the OpenCode Zen API for free AI coding capabilities.

## Files Rewritten

### Core Config (3 files)
- `package.json` - Changed name to "opencode-android", description to "OpenCode AI Coding Agent for Android"
- `capacitor.config.ts` - appId: "com.opencode.android", appName: "OpenCode"
- `index.html` - Title: "OpenCode", terminal-style splash screen

### TypeScript Types (1 file)
- `src/types/index.ts` - Simplified types: OpenCodeProvider, OpenCodeMessage, OpenCodeToolCall, ViewMode, AppConfig, AgentState, etc.
- Removed all phone/SMS/UI automation tool types
- Focused on OpenCode's core tools: shell, file_read/write/edit, glob, grep, web_fetch, web_search

### Utilities (1 file)
- `src/utils/config.ts` - DEFAULT_PROVIDERS: OpenCode Zen (FREE, default), OpenAI, Anthropic, Google, Mistral, xAI
- FREE_MODELS: deepseek-v4-flash-free (default), big-pickle, minimax-m2.5-free, nemotron-3-super-free
- SYSTEM_PROMPT: Optimized for coding agent with OpenCode's tool set
- TOOL_DEFINITIONS: 13 tools matching OpenCode's tools

### Services (4 files)
- `src/services/api.ts` - OpenAI-compatible API client for OpenCode Zen endpoint
- `src/services/agent.ts` - ReAct agent loop with tool calling support
- `src/services/bridge.ts` - Simplified native bridge with OpenCode's tools only
- `src/services/opencode-bridge.ts` - Proot bridge for arm64 devices

### Main App (1 file)
- `src/App.tsx` - Single view architecture, slash commands (/compact, /models, /help), tool approval flow

### Components (5 files)
- `src/components/OpenCodeChat.tsx` - Terminal-inspired chat interface (main view)
- `src/components/TerminalView.tsx` - Shell terminal for direct command execution
- `src/components/FileExplorer.tsx` - File browser with read/write
- `src/components/SettingsView.tsx` - 5 tabs: Providers, Agent, Proxy, OpenCode, About
- `src/components/Sidebar.tsx` - Simplified navigation with OpenCode branding

### Styles (1 file)
- `src/styles/global.css` - OpenCode terminal theme (GitHub dark, green/purple accents)

### Android Build Files
- `android/app/build.gradle` - applicationId: "com.opencode.android", version 1.0.0
- `android/app/src/main/AndroidManifest.xml` - package: com.opencode.android, removed SMS/call/accessibility services
- `android/app/src/main/res/values/strings.xml` - App name: "OpenCode"
- `android/app/src/main/res/values/colors.xml` - OpenCode green/purple accent colors

### Android Java Files (3 files, new package)
- `android/app/src/main/java/com/opencode/android/MainActivity.java` - Registers OpenCodeBridgePlugin and OpenCodeProotPlugin
- `android/app/src/main/java/com/opencode/android/OpenCodeBridgePlugin.java` - Simplified bridge: shell, files, HTTP, device info, toast
- `android/app/src/main/java/com/opencode/android/OpenCodeProotPlugin.java` - Proot/Ubuntu/OpenCode setup (from original with package rename)

### Android Asset Scripts (3 files)
- `android/app/src/main/assets/opencode/setup-ubuntu.sh` - Ubuntu Base setup
- `android/app/src/main/assets/opencode/install-opencode.sh` - OpenCode installer with --no-modify-path
- `android/app/src/main/assets/opencode/run-opencode.sh` - Proot launcher with 32-bit warnings

## Files Deleted
- `src/components/WelcomeScreen.tsx` - Replaced by welcome screen in OpenCodeChat
- `src/components/ZAIBrowser.tsx` - Removed (not OpenCode-related)
- `src/components/OpenCodeView.tsx` - Removed (replaced by OpenCodeChat + Settings opencode tab)
- `src/components/ChatView.tsx` - Removed (replaced by OpenCodeChat)
- `android/app/src/main/java/com/qwen/` - Old package directory removed

## Key Changes
1. **Default experience**: Works immediately with OpenCode Zen free models, no API key needed
2. **Terminal-inspired UI**: Dark theme with green/purple accents, monospace fonts, `>_` prompt
3. **Simplified tool set**: Only OpenCode's core tools (shell, files, search, web)
4. **Free by default**: DeepSeek V4 Flash Free as default model
5. **32-bit awareness**: Proot mode hidden with warning for armeabi-v7a devices
6. **Slash commands**: /compact, /models, /help built into the chat
7. **Proxy support**: Cuba proxy preserved via aiql.com

## Build Verification
- TypeScript compilation: ✅ No errors
- Vite build: ✅ Successful (635KB JS, 5KB CSS)
- All source files verified present and correct
