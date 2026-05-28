# ◆ OpenCode AI for Android

> AI coding agent that runs entirely on your Android phone.
> Multi-provider, free models, real shell + filesystem + web tools, built-in `opencode` CLI in the terminal.

![Build](https://github.com/iroennys-admin/qwen-code-android/actions/workflows/build.yml/badge.svg)

---

## ✨ Highlights

- 🤖 **15+ AI providers** — Z.AI (GLM), Groq, Cerebras, Gemini, OpenRouter, NVIDIA NIM, Mistral, DeepSeek, GitHub Models, Cohere, SambaNova, xAI Grok, OpenAI, Anthropic, custom OpenAI-compatible.
- 🆓 **Most have free tiers** — works out of the box with GLM-4.5-Flash on Z.AI, no payment required.
- 🛠️ **23 built-in tools** — shell, file_read/write/edit/append, list_dir, glob, grep, web_fetch, web_search (DuckDuckGo + Jina Reader), mkdir, rm, mv, cp, todo_*, memory_*, clipboard_*, notify, device_info.
- 💻 **Real terminal** — type `opencode` for an interactive REPL inside the app (works on 32-bit ARMv7 too, all JS).
- 📁 **File explorer + editor** baked in.
- 🧠 **Persistent memory** + **TODOs** the agent can manage across chats.
- 🎨 **4 themes** — Aurora, Midnight, Cyber, Classic Dark.
- 🇨🇺 **Reverse-proxy support** for users behind geo-blocks.
- 📱 **ARMv7 + ARM64 + x86_64** universal APK.

---

## 📥 Install

Grab the latest APK from [Releases](https://github.com/iroennys-admin/qwen-code-android/releases) or from the [Actions](https://github.com/iroennys-admin/qwen-code-android/actions) tab → latest workflow run → `OpenCodeAI-APKs` artifact.

1. Open the APK on your device.
2. Allow "Install from unknown sources" if prompted.
3. On first launch, grant storage permission (Settings → Apps → OpenCode AI → Permissions → Files & media → All files).

---

## 🔑 Setup an AI provider

Open ⚙️ **Settings** → choose any free provider → tap "Get API key" → paste it.

### Recommended free providers

| Provider | Models (free) | Get key |
|---|---|---|
| 🇨🇳 **Z.AI** | GLM-4.5-Flash, GLM-4-Flash, GLM-4V-Flash (vision) | [z.ai](https://z.ai/manage-apikey/apikey-list) |
| ⚡ **Groq** | Llama 3.3 70B, Qwen3 32B, GPT-OSS 120B, Kimi K2 | [console.groq.com](https://console.groq.com/keys) |
| 🧠 **Cerebras** | Llama 3.3 70B, Qwen3 235B, GPT-OSS 120B | [cloud.cerebras.ai](https://cloud.cerebras.ai/) |
| ✨ **Google Gemini** | Gemini 2.5 Pro/Flash (1M ctx, vision) | [aistudio.google.com](https://aistudio.google.com/apikey) |
| 🔀 **OpenRouter** | 10+ free models, single key | [openrouter.ai](https://openrouter.ai/keys) |
| 💚 **NVIDIA NIM** | DeepSeek R1/V3.1, Qwen3 Coder 480B | [build.nvidia.com](https://build.nvidia.com/) |
| 🌪️ **Mistral** | Mistral Large, Codestral (1B tok/month) | [console.mistral.ai](https://console.mistral.ai/api-keys) |

---

## 💻 Terminal with `opencode` CLI

Tap the **⌨️ Terminal** tab and type:

```bash
opencode                          # interactive REPL
opencode "list files in /sdcard"  # one-shot prompt
opencode --provider groq          # switch provider
opencode --model llama-3.3-70b-versatile
opencode --list-models
oc help                           # short alias
```

Inside the REPL:

```
/help      /exit       /clear       /reset
/model X   /provider X /system "..."
/models    /providers  /config      /tools
/save chat.json   /load chat.json   /history
```

All other terminal input runs as a normal **shell** command on the device (`ls`, `pwd`, `cat`, `pkg install`, etc.).

---

## 🧰 Tools the agent can call

| Tool | Description |
|---|---|
| `shell` | Run any shell command (asks approval by default) |
| `file_read` | Read a file (with optional line range) |
| `file_write` | Write/overwrite a file (auto-approved in safe mode) |
| `file_edit` | Precise find-and-replace inside a file |
| `file_append` | Append to a file |
| `list_dir`, `glob`, `grep` | Discover files & search |
| `mkdir`, `rm`, `mv`, `cp` | File ops |
| `web_fetch` | Fetch a URL (HTML → readable text via Jina Reader fallback) |
| `web_search` | DuckDuckGo HTML search, no key needed |
| `todo_add/list/complete` | Persistent TODO list |
| `memory_save/get` | Long-term key/value memory |
| `clipboard_copy/read` | Read/write device clipboard |
| `notify` | Show a toast |
| `device_info` | Phone info, storage, ABI, root status |

Approval modes: **ask** (safest), **auto_edit** (recommended), **yolo**.

---

## 🛠️ Build from source

```bash
git clone https://github.com/iroennys-admin/qwen-code-android.git
cd qwen-code-android
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Tagging `v*` triggers a GitHub Release automatically with the APK attached.

---

## 🏗️ Architecture

```
src/
  App.tsx                Main app
  components/
    ChatView.tsx         AI chat UI
    MessageBubble.tsx    Markdown + tool-call rendering
    TerminalView.tsx     Built-in terminal w/ opencode CLI
    FileExplorer.tsx     Browse / edit files
    SettingsView.tsx     Configure providers, theme, tools
    AboutView.tsx        Device info, todos, memory
  services/
    api.ts               OpenAI-compatible + Anthropic streaming client
    agent.ts             Agent loop (think → tool → act)
    bridge.ts            Capacitor native bridge (shell, files, http, clipboard)
    opencode-cli.ts      In-app opencode CLI
  utils/config.ts        Providers, models, tool defs, system prompt
  types/index.ts         Type definitions
  styles/global.css      Aurora design system (4 themes)
android/
  app/src/main/java/com/opencode/android/
    MainActivity.java
    OpenCodeBridgePlugin.java   Native bridge (Java)
.github/workflows/build.yml      CI: builds debug + release APK
```

---

## 📜 License

MIT
