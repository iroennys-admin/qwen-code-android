# Qwen Code Android 🤖📱

AI Code Agent para Android con interfaz Fluent Design, soporte multi-provider y ejecución de comandos shell.

## ✨ Características

- 🤖 **Multi-Provider AI** - OpenRouter, NVIDIA NIM, Mistral, Grok (xAI)
- 💻 **Ejecución de Comandos Shell** - Ejecuta comandos directamente en tu dispositivo
- 📁 **Acceso al Sistema de Archivos** - Lee, escribe y edita archivos
- 🌐 **Proxy para Cuba** - Soporte iql proxy por defecto para conectividad
- ⚡ **Streaming en Tiempo Real** - Respuestas de IA en vivo
- 🔧 **Tool Use** - Shell, file_read, file_write, file_edit, web_fetch, glob, grep
- 🎨 **Interfaz Fluent Design** - UI futurista estilo Windows
- 📱 **32/64 bits** - Compatible con armeabi-v7a y arm64-v8a

## 📥 Instalación

Descarga el APK desde [GitHub Releases](https://github.com/iroennys-admin/qwen-code-android/releases) o compílalo tú mismo.

### Descarga Directa

1. Ve a la sección de Releases en el repositorio
2. Descarga el archivo `qwen-code-release-universal.apk`
3. Instálalo en tu dispositivo Android

### Compilación desde Código Fuente

```bash
# Clonar el repositorio
git clone https://github.com/iroennys-admin/qwen-code-android.git
cd qwen-code-android

# Instalar dependencias
npm install

# Compilar la web app
npx vite build

# Sincronizar con Capacitor
npx cap sync android

# Compilar APK
cd android
./gradlew assembleDebug
```

## 🔑 Configuración de API Keys

1. Abre la app y ve a **Configuración** (⚙️)
2. Selecciona el proveedor que deseas usar
3. Ingresa tu API key
4. Presiona **Test** para verificar la conexión

### Proveedores Soportados

| Proveedor | Sitio Web | Modelos |
|-----------|-----------|---------|
| OpenRouter | openrouter.ai | 350+ modelos (incluyendo gratuitos) |
| NVIDIA NIM | build.nvidia.com | Llama, Qwen, DeepSeek, Mistral |
| Mistral | mistral.ai | Mistral Large, Codestral |
| Grok (xAI) | x.ai | Grok 3, Grok 2 |

## 🇨🇺 Proxy para Cuba

El proxy iql está habilitado por defecto para permitir acceso desde Cuba a todas las APIs. Si necesitas desactivarlo o cambiar la URL:

1. Ve a **Configuración** → **Proxy**
2. Activa/desactiva el proxy
3. Modifica la URL del proxy si es necesario

## 🛠️ Herramientas Disponibles

El agente de IA tiene acceso a las siguientes herramientas:

- **shell** - Ejecutar comandos en el terminal del dispositivo
- **file_read** - Leer contenido de archivos
- **file_write** - Crear o sobreescribir archivos
- **file_edit** - Editar archivos (buscar y reemplazar)
- **web_fetch** - Obtener contenido de URLs
- **glob** - Buscar archivos por patrón
- **grep** - Buscar contenido en archivos

## 🏗️ Arquitectura

```
qwen-code-android/
├── src/                    # React web app (UI + AI logic)
│   ├── components/         # UI components (Chat, Terminal, Files, Settings)
│   ├── services/           # API service, Native bridge
│   ├── types/              # TypeScript types
│   ├── utils/              # Config, constants
│   └── styles/             # Global CSS (Fluent Design)
├── android/                # Capacitor Android project
│   └── app/src/main/java/  # Native Java bridge for shell/files
├── .github/workflows/      # GitHub Actions CI/CD
└── capacitor.config.ts     # Capacitor configuration
```

## 📄 Licencia

MIT License
