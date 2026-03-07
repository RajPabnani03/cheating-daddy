# CLAUDE.md — Cheating Daddy Codebase Guide

This file provides context, conventions, and workflows for AI assistants working in this repository.

---

## Project Overview

**Cheating Daddy** is an Electron desktop application that provides real-time AI assistance during video interviews, presentations, meetings, and exams. It captures the screen and audio in real-time, streams the data to Google's Gemini Live API, and displays AI-generated responses in an always-on-top transparent overlay window.

- **Version**: 0.4.0
- **License**: GPL-3.0
- **Author**: sohzm (sohambharambe9@gmail.com)
- **Framework**: Electron + LitElement (Web Components)
- **AI Backend**: Google Gemini Live 2.5 Flash (via `@google/genai`)

---

## Directory Structure

```
cheating-daddy/
├── src/
│   ├── index.js              # Electron main process entry point
│   ├── index.html            # HTML shell loaded by the renderer
│   ├── preload.js            # Electron preload script (contextBridge)
│   ├── audioUtils.js         # PCM/WAV audio processing utilities
│   ├── components/
│   │   ├── index.js          # Component barrel export
│   │   ├── app/
│   │   │   ├── CheatingDaddyApp.js   # Root LitElement component (~522 lines)
│   │   │   └── AppHeader.js          # Header bar with controls
│   │   └── views/
│   │       ├── MainView.js           # API key entry + session start
│   │       ├── AssistantView.js      # Live AI response display
│   │       ├── CustomizeView.js      # Profile/language/quality settings
│   │       ├── HistoryView.js        # Browsable conversation history
│   │       ├── HelpView.js           # In-app help documentation
│   │       ├── OnboardingView.js     # First-run setup wizard
│   │       └── AdvancedView.js       # Advanced settings (layout, keybinds)
│   ├── utils/
│   │   ├── gemini.js         # Gemini Live API session management (673 lines)
│   │   ├── window.js         # Electron window creation & shortcuts (517 lines)
│   │   ├── renderer.js       # Renderer-side capture & streaming logic (739 lines)
│   │   ├── stealthFeatures.js    # Process hiding / obfuscation (134 lines)
│   │   ├── processNames.js       # Random process name generation (215 lines)
│   │   ├── processRandomizer.js  # Initializes random naming on startup
│   │   ├── prompts.js            # System prompts per AI profile (226 lines)
│   │   └── windowResize.js       # Window size animation helpers
│   └── assets/
│       ├── logo.png/icns/ico         # App icons
│       ├── SystemAudioDump           # macOS system-audio capture binary
│       ├── lit-core-2.7.4.min.js    # LitElement core (bundled, no npm)
│       ├── lit-all-2.7.4.min.js     # LitElement full (bundled, no npm)
│       ├── marked-4.3.0.min.js      # Markdown parser (bundled, no npm)
│       ├── onboarding/               # SVG assets for onboarding screens
│       └── old/                      # Legacy assets (do not edit)
├── forge.config.js           # Electron Forge platform makers + ASAR config
├── entitlements.plist        # macOS sandbox/permission entitlements
├── package.json              # Dependencies, scripts, build metadata
├── package-lock.json         # Locked dependency tree
├── .prettierrc               # Formatting rules
├── .prettierignore           # Files excluded from Prettier
└── .gitignore
```

---

## Architecture

### Process Model

The app follows the standard Electron two-process model:

| Process | Entry | Role |
|---------|-------|------|
| **Main** | `src/index.js` | Window creation, IPC registration, Gemini session management, stealth initialization |
| **Renderer** | `src/index.html` + `src/utils/renderer.js` | UI components, media capture, streaming audio/images to main via IPC |

Communication between processes uses **Electron IPC** (`ipcMain`/`ipcRenderer`) and a preload script (`src/preload.js`) that exposes a `window.electronAPI` bridge.

### Frontend Framework

- **LitElement** (loaded from `src/assets/` — not installed via npm).
- All components extend `LitElement` and use `lit-html` templates.
- Components use **CSS custom properties** for theming (dark theme throughout).
- State is managed inside `CheatingDaddyApp.js`; child views receive props and emit events upward.
- View routing is a simple string property (`currentView`) switching which view component is rendered.

### Data Flow

```
Screen / Mic / System Audio
        │
        ▼
  renderer.js (MediaRecorder / getUserMedia / SystemAudioDump)
        │ IPC: send-audio-content / send-image-content / send-text-message
        ▼
  gemini.js (main process)
        │ @google/genai Live session (WebSocket)
        ▼
  Gemini Live 2.5 Flash API
        │ streaming text response
        ▼
  gemini.js → IPC events → renderer → AssistantView
```

---

## Key Files — What to Know Before Editing

### `src/utils/gemini.js`
- Manages the `@google/genai` Live session lifecycle (connect, reconnect up to 3 times with 2-second delays, close).
- Registers all IPC handlers (`initialize-gemini`, `send-audio-content`, `send-image-content`, `send-text-message`, `start-macos-audio`, `stop-macos-audio`, `close-session`, `get-current-session`, `start-new-session`).
- Saves conversation turns to **IndexedDB** (`ConversationHistory` database, `sessions` object store).
- Supports optional Google Search tool integration per session.

### `src/utils/window.js`
- Creates a frameless, transparent, always-on-top `BrowserWindow`.
- Registers all **global keyboard shortcuts** (movement, click-through toggle, visibility toggle, response navigation, scroll).
- Handles animated window resize on layout mode change.
- Enables content protection (prevents screenshot/recording of overlay).

### `src/utils/renderer.js`
- Handles screen capture (JPEG screenshots via `canvas`), audio capture (PCM 16-bit @ 24kHz, 100ms chunks), and token usage tracking.
- Exposes a global `cheddar` object consumed by LitElement components.
- Platform detection: macOS uses `SystemAudioDump` binary, Windows uses loopback via `getDisplayMedia`, Linux falls back to microphone.

### `src/utils/prompts.js`
- Exports a `getSystemPrompt(profile, customPrompt)` function.
- Profiles: `interview`, `sales`, `meeting`, `presentation`, `negotiation`, `exam`.
- Add new profiles here; they are automatically available in `CustomizeView`.

### `src/utils/stealthFeatures.js`
- Hides the window from the Windows taskbar and macOS Mission Control.
- Randomizes the window title every 30–60 seconds.
- Delays startup by 1–4 seconds (anti-analysis).
- Clears the console in production (`NODE_ENV=production`).

### `src/components/app/CheatingDaddyApp.js`
- Root LitElement component; owns all app state.
- All `localStorage` reads/writes happen here.
- View routing via `this.currentView` string property.

---

## Settings & Persistence

All user settings are stored in **`localStorage`** (renderer process):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | string | — | Google Gemini API key |
| `selectedProfile` | string | `interview` | Active AI profile |
| `selectedLanguage` | string | `en-US` | Speech language code |
| `selectedScreenshotInterval` | string | `10` | Capture interval in seconds (`5`/`10`/`15`/`30`/`manual`) |
| `selectedImageQuality` | string | `medium` | JPEG quality (`low`/`medium`/`high`) |
| `layoutMode` | string | `normal` | Window size (`normal`/`compact`) |
| `advancedMode` | boolean | `false` | Enables advanced settings panel |
| `customKeybinds` | JSON string | — | User-defined keyboard shortcuts |
| `customPrompt` | string | — | Additional context injected into system prompt |
| `contentProtection` | boolean | `true` | Blocks screenshot/recording of overlay |
| `googleSearchEnabled` | boolean | `false` | Enables Google Search tool in Gemini session |
| `throttleTokens` | boolean | `false` | Enables token-rate limiting |
| `maxTokensPerMin` | number | — | Token limit per minute |
| `throttleAtPercent` | number | — | Start throttling at X% of limit |

**Conversation history** is stored in **IndexedDB** (`ConversationHistory` database, `sessions` object store), keyed by `sessionId` (timestamp-based UUID).

---

## Development Workflow

### Prerequisites
- **Node.js** (v18+ recommended)
- **npm**
- A **Google Gemini API key** from [aistudio.google.com](https://aistudio.google.com)

### Install & Run

```bash
npm install
npm start          # Launch Electron in dev mode
```

### Build Distributables

```bash
npm run package    # Creates unpacked app in out/
npm run make       # Creates platform-specific installers (DMG, exe, deb, rpm, AppImage)
```

### Code Formatting

Prettier is configured — run before committing:

```bash
npx prettier --write src/
```

**Prettier settings** (`.prettierrc`):
- Tab width: 4 spaces
- Print width: 150 characters
- Trailing commas: `all`
- Semicolons: `true`

### No Tests

There is no test suite. Manual testing in the running app is the only verification method. If adding tests, consider [Spectron](https://www.electronjs.org/spectron) or [Playwright](https://playwright.dev/) for Electron.

---

## IPC API Reference

All IPC channels are registered in `src/utils/gemini.js` and `src/utils/window.js`.

### Main ← Renderer (invoke / send)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `initialize-gemini` | invoke | Start a new Gemini Live session with config |
| `send-audio-content` | send | Stream a 100ms PCM audio chunk to Gemini |
| `send-image-content` | send | Send a JPEG screenshot (base64) to Gemini |
| `send-text-message` | invoke | Send a typed text message to Gemini |
| `start-macos-audio` | invoke | Launch `SystemAudioDump` subprocess (macOS) |
| `stop-macos-audio` | invoke | Kill `SystemAudioDump` subprocess (macOS) |
| `close-session` | invoke | Terminate current Gemini session |
| `get-current-session` | invoke | Retrieve current session transcript |
| `start-new-session` | invoke | Reset to a new conversation session |

### Renderer ← Main (on)

| Channel | Description |
|---------|-------------|
| `gemini-response` | Streaming text chunk from Gemini |
| `gemini-turn-complete` | AI turn finished; response is complete |
| `gemini-transcription` | Audio transcription result |
| `gemini-error` | Session error or disconnect |
| `window-shortcut` | Keyboard shortcut triggered in main process |

---

## Keyboard Shortcuts (Default)

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + ↑` | Move window up |
| `Ctrl/Cmd + ↓` | Move window down |
| `Ctrl/Cmd + ←` | Move window left |
| `Ctrl/Cmd + →` | Move window right |
| `Ctrl/Cmd + M` | Toggle click-through mode |
| `Ctrl/Cmd + \` | Hide/show window |
| `Enter` | Send text input / trigger manual screenshot |

Custom keybinds are stored in `localStorage.customKeybinds` as a JSON object and loaded in `src/utils/window.js`.

---

## Platform-Specific Notes

### macOS
- Uses bundled `src/assets/SystemAudioDump` binary for system-audio capture.
- App name is randomized via `app.setName()` for stealth.
- Window hidden from Mission Control via `setHiddenInMissionControl(true)`.
- Code signing entitlements are defined in `entitlements.plist`.

### Windows
- Loopback audio captured via `getDisplayMedia` (`{audio: true, video: false}`).
- Window hidden from taskbar via `setSkipTaskbar(true)`.
- Installer built with `@electron-forge/maker-squirrel`.

### Linux
- Falls back to microphone input when system audio is unavailable.
- Packaged as `.deb`, `.rpm`, and `.AppImage`.

---

## Stealth & Obfuscation Features

The app deliberately obscures itself from process monitors and screen-recording detection:

- **Random process name**: `process.title` is set to a name like `"Google AudioHelper"` or `"Microsoft ServiceAgent"` on startup (`src/utils/processRandomizer.js` + `src/utils/processNames.js`).
- **Rotating window titles**: Title changes every 30–60 seconds to legitimate-sounding strings.
- **Content protection**: `win.setContentProtection(true)` prevents the window from appearing in screenshots or screen recordings taken by other apps.
- **No taskbar/dock entry**: Hidden from Windows taskbar and macOS Mission Control.
- **Anti-analysis delay**: App startup delayed 1–4 seconds randomly.
- **Console clearing**: `console.clear()` called periodically in production.

When modifying stealth features, keep changes isolated to `src/utils/stealthFeatures.js` and `src/utils/processNames.js`.

---

## AI Profiles

Profiles are defined in `src/utils/prompts.js` and selected by the user in `CustomizeView`.

| Profile | Use Case |
|---------|----------|
| `interview` | Technical and behavioral interview Q&A |
| `sales` | Sales calls with objection handling |
| `meeting` | Business meeting discussion support |
| `presentation` | Presentation coaching and Q&A prep |
| `negotiation` | Deal-making conversation assistance |
| `exam` | Direct, concise exam answer generation |

To add a new profile:
1. Add a new `case` in `getSystemPrompt()` in `src/utils/prompts.js`.
2. Add the profile option to the selector in `src/components/views/CustomizeView.js`.

---

## Common Conventions

- **No module bundler**: LitElement and Marked are loaded from `src/assets/` as pre-built minified files. Do not import them via npm.
- **Async IPC**: Use `ipcRenderer.invoke()` for request/response, `ipcRenderer.on()` for streams.
- **Error handling**: Gemini session errors auto-reconnect up to 3 times; surface errors to the renderer via the `gemini-error` IPC channel.
- **No TypeScript**: The project is plain JavaScript (ES2020+). Do not introduce TypeScript.
- **Styling**: All styles are written as CSS template literals inside LitElement `static styles`. Follow existing dark-theme color variables.
- **State management**: Keep application state in `CheatingDaddyApp.js`. Do not introduce a state management library.
- **Token budget**: Screenshots consume ~258 base tokens + tiling overhead; audio consumes ~32 tokens/second. Throttling logic is in `src/utils/renderer.js`.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV=production` | Enables console clearing in stealth mode |
| `DEBUG_AUDIO` | Saves raw PCM + WAV + metadata to `~/cheddar/debug/` |

Data written to disk goes under `~/cheddar/`:
- `~/cheddar/data/image/` — captured screenshots
- `~/cheddar/data/audio/` — debug audio recordings

---

## Dependency Notes

| Package | Version | Purpose |
|---------|---------|---------|
| `@google/genai` | ^1.2.0 | Google Gemini Live API client |
| `electron` | ^30.0.5 | Desktop app framework |
| `electron-squirrel-startup` | ^1.0.1 | Windows installer auto-update support |
| `@electron-forge/cli` | ^7.8.1 | Build & packaging toolchain |
| `@electron/fuses` | ^1.8.0 | Electron security fuse configuration |

LitElement, lit-html, and Marked are **not** in `package.json` — they are pre-bundled in `src/assets/`.
