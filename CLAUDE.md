# CLAUDE.md — Cheating Daddy

This file provides guidance for AI assistants working in this codebase.

---

## Project Overview

**Cheating Daddy** is an Electron desktop application that provides real-time AI assistance during video calls, interviews, meetings, and exams. It captures screen and audio, sends them to Google Gemini 2.0 Flash Live, and displays AI responses as a transparent always-on-top overlay.

- **License**: GPL-3.0
- **Version**: 0.4.0
- **Author**: sohzm (sohambharambe9@gmail.com)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 30 |
| Build system | Electron Forge 7 |
| UI framework | Lit 2.7.4 (web components, loaded as minified CDN-style asset) |
| AI backend | Google Gemini 2.0 Flash Live (`@google/genai` ^1.2.0) |
| Markdown | marked 4.3.0 |
| Persistence | `localStorage` (settings) + IndexedDB (conversation history) |
| Audio (macOS) | Bundled `SystemAudioDump` native binary |

No TypeScript, no bundler (webpack/vite), no test framework.

---

## Directory Structure

```
cheating-daddy/
├── src/
│   ├── index.js              # Electron main process — app init, IPC, stealth setup
│   ├── index.html            # Single HTML entry point; mounts <cheating-daddy-app>
│   ├── preload.js            # Empty preload script (reserved)
│   ├── audioUtils.js         # Float32 → Int16 PCM conversion, audio analysis
│   ├── components/
│   │   ├── app/
│   │   │   ├── CheatingDaddyApp.js   # Root Lit component; state machine, view router
│   │   │   └── AppHeader.js          # Title bar, status timer, action buttons
│   │   ├── views/
│   │   │   ├── MainView.js           # API key input, start button
│   │   │   ├── AssistantView.js      # AI response display with markdown
│   │   │   ├── CustomizeView.js      # User settings (profile, language, intervals…)
│   │   │   ├── AdvancedView.js       # Advanced settings + token tracking
│   │   │   ├── OnboardingView.js     # 5-step first-run onboarding
│   │   │   ├── HelpView.js           # Documentation / external links
│   │   │   └── HistoryView.js        # Conversation history browser
│   │   └── index.js                  # Re-exports all components
│   ├── utils/
│   │   ├── gemini.js           # Gemini Live API — session init, streaming, IPC handlers
│   │   ├── window.js           # Frameless window creation, global shortcuts, stealth props
│   │   ├── renderer.js         # Screen/audio capture, token tracker, IndexedDB helpers
│   │   ├── prompts.js          # System prompt strings for each profile
│   │   ├── stealthFeatures.js  # Anti-detection: process name, title randomization, etc.
│   │   ├── processNames.js     # Random "legitimate" process name generator
│   │   ├── processRandomizer.js # Applies random process names at startup
│   │   └── windowResize.js     # Window resize helpers
│   └── assets/
│       ├── lit-core-2.7.4.min.js
│       ├── lit-all-2.7.4.min.js
│       ├── marked-4.3.0.min.js
│       ├── SystemAudioDump      # macOS native binary for system audio capture
│       └── logo.*               # App icons
├── forge.config.js    # Electron Forge build config (all platforms)
├── entitlements.plist # macOS code signing entitlements
├── package.json
├── .prettierrc
└── README.md
```

---

## Architecture

### Process Model

```
Main Process (src/index.js)
│  ├── Creates BrowserWindow via window.js
│  ├── Manages Gemini session lifecycle via gemini.js
│  ├── Spawns SystemAudioDump subprocess (macOS)
│  └── Registers global IPC handlers
│
Renderer Process (src/index.html)
│  ├── <cheating-daddy-app> — root Lit component (CheatingDaddyApp.js)
│  │    ├── <app-header>
│  │    └── <*-view> — routed by currentView property
│  └── renderer.js — screen/audio capture runs here; sends data to main via IPC
```

### IPC Channel Conventions

IPC is the bridge between renderer capture logic and main-process Gemini handling. Key channels defined in `gemini.js`:

| Channel | Direction | Purpose |
|---|---|---|
| `gemini-send-audio` | renderer → main | Send PCM audio chunk |
| `gemini-send-image` | renderer → main | Send JPEG screenshot |
| `gemini-send-text` | renderer → main | Send user text message |
| `gemini-response` | main → renderer | Stream AI response text |
| `gemini-status` | main → renderer | Connection status updates |
| `gemini-error` | main → renderer | Error messages |
| `gemini-session-start` | renderer → main | Initialize new session |
| `gemini-session-stop` | renderer → main | Tear down session |
| `quit-app` | renderer → main | Exit application |
| `open-external` | renderer → main | Open URL in browser |
| `toggle-content-protection` | renderer → main | Enable/disable screen protection |
| `update-keybinds` | renderer → main | Register new global shortcuts |

### State Management

All persistent user preferences live in `localStorage` with these keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `apiKey` | string | — | Gemini API key |
| `selectedProfile` | string | `'interview'` | Active profile |
| `selectedLanguage` | string | `'en-US'` | UI/response language |
| `selectedScreenshotInterval` | string | `'5'` | Seconds between auto-screenshots |
| `selectedImageQuality` | string | `'medium'` | JPEG quality (low/medium/high) |
| `layoutMode` | string | `'normal'` | Layout variant |
| `advancedMode` | boolean | `false` | Show advanced settings |
| `customKeybinds` | JSON string | — | Custom keyboard shortcuts |
| `customPrompt` | string | — | Extra instructions appended to system prompt |
| `contentProtection` | boolean | `true` | Prevent screen capture of app window |
| `throttleTokens` | boolean | — | Enable token rate limiting |
| `maxTokensPerMin` | number | — | Token threshold |
| `throttleAtPercent` | number | — | Throttle trigger percentage |

Conversation history is stored in **IndexedDB** (`ConversationHistory` database, `sessions` store):

```js
{
  sessionId: string,       // primary key
  timestamp: number,
  conversationHistory: [
    { timestamp, transcription, ai_response }
  ],
  lastUpdated: number
}
```

---

## Key Files In Depth

### `src/index.js` — Main Process

- Initializes the Electron app; applies stealth properties before window creation
- Calls `createWindow()` (from `window.js`) then `setupGeminiIpcHandlers()` (from `gemini.js`)
- Registers IPC handlers for app quit, external link opening, content protection toggling, and keybind updates
- Manages macOS `SystemAudioDump` subprocess lifecycle (start/stop on session events)

### `src/utils/gemini.js` — Gemini Integration

- `initializeGeminiSession(apiKey, profile, customPrompt, language)`: Creates a live bidirectional WebSocket session with Gemini 2.0 Flash
- `sendReconnectionContext()`: Replays conversation history to restore context after reconnect
- `attemptReconnection()`: Exponential-backoff reconnect (max 3 attempts)
- `setupGeminiIpcHandlers()`: Wires all IPC channels to Gemini session methods
- Token counting via `countTokensForContent()` feeds the rate limiter in the renderer

### `src/utils/window.js` — Window Management

- Creates a frameless, transparent, always-on-top `BrowserWindow` (no taskbar/dock entry)
- Enables content protection by default
- macOS: sets `skipTaskbar`, hides from Mission Control (`NSWindowCollectionBehaviorMoveToActiveSpace` via `hiddenInMissionControl`)
- Windows: forces z-order above screensaver, hides from Alt+Tab
- Registers global shortcuts: `Ctrl/Cmd+Arrow` (move), `Ctrl/Cmd+\` (close/back), `Ctrl/Cmd+M` (toggle click-through)
- Data directory: `~/cheddar/data/{image,audio}`

### `src/utils/renderer.js` — Capture Logic

- `startCapture()` / `stopCapture()`: Manage periodic screenshot + audio capture loops
- Screenshot pipeline: `getDisplayMedia()` → canvas → JPEG blob → IPC
- Audio pipeline:
  - **macOS**: System audio from `SystemAudioDump` subprocess stdout
  - **Windows**: `getDisplayMedia({ audio: true })` loopback
  - **Linux**: `getUserMedia({ audio: true })` microphone
- Audio conversion: `Float32Array` → `Int16Array` PCM at 24 kHz
- `TokenTracker`: Calculates and tracks Gemini API token usage per minute

### `src/utils/prompts.js` — Profile Prompts

Six profiles: `interview`, `sales`, `meeting`, `presentation`, `negotiation`, `exam`.

Each profile string includes: role description, formatting rules (brevity, markdown, bullet points), when to use Google Search, and output examples. All prompts emphasize **2–3 sentence maximum responses** ready to be spoken aloud.

### `src/utils/stealthFeatures.js`

- `randomizeProcessName()`: Sets `app.setName()` to a random system-sounding string
- `startWindowTitleRandomizer()`: Changes window title every 30–60 seconds
- `applyStealthWindowProperties()`: Hides from Alt+Tab (Windows) and Mission Control (macOS)
- `getRandomUserAgent()`: Assigns a random legitimate-looking user agent

---

## Development Workflow

### Prerequisites

- Node.js (LTS recommended)
- npm

### Setup

```bash
npm install
```

### Run in Development

```bash
npm start
# Starts Electron via electron-forge with hot-reload on file changes
```

### Build

```bash
npm run package   # Package app (no installer)
npm run make      # Build platform installer (DMG, EXE, DEB, RPM, AppImage)
npm run publish   # Publish build artifacts
```

### Linting / Formatting

There is **no linting** configured (`lint` script is a no-op). Prettier is configured:

```json
{
  "semi": true,
  "tabWidth": 4,
  "printWidth": 150,
  "singleQuote": true,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

Run Prettier manually: `npx prettier --write src/`

### Testing

**There are no tests.** When adding features, manually verify:
1. App starts without errors (`npm start`)
2. Each modified view renders correctly
3. IPC channels behave as expected (check DevTools console)
4. Audio/screen capture works on the target platform

---

## Code Conventions

### JavaScript Style

- **No TypeScript** — plain JS throughout
- 4-space indentation, single quotes, semicolons (enforced by Prettier)
- Arrow functions prefer no parens for single params: `x => x * 2`
- Class-based Lit components with `static properties` for reactive state

### Lit Web Components Pattern

All UI components extend `LitElement`:

```js
import { LitElement, html, css } from '../../assets/lit-core-2.7.4.min.js';

class MyView extends LitElement {
    static properties = {
        myProp: { type: String },
    };

    static styles = css`
        :host { display: block; }
    `;

    render() {
        return html`<div>${this.myProp}</div>`;
    }
}

customElements.define('my-view', MyView);
export { MyView };
```

- Import Lit from local `assets/` path, not npm
- Use `@google/genai` SDK imports via `require()` in main-process files only
- Renderer process files cannot use `require()` — use IPC to communicate with main

### IPC Pattern

**Renderer → Main (one-way):**
```js
window.electronAPI.send('channel-name', data);
```

**Main → Renderer (push):**
```js
mainWindow.webContents.send('channel-name', data);
```

**Main process handler:**
```js
ipcMain.on('channel-name', (event, data) => { /* ... */ });
```

### Adding a New Profile

1. Open `src/utils/prompts.js`
2. Add a new key to the exported `prompts` object following the existing structure
3. Register it in `CustomizeView.js` in the profile selector options
4. The key will be passed through `initializeGeminiSession()` automatically

### Adding a New View

1. Create `src/components/views/MyNewView.js` following the Lit component pattern
2. Export from `src/components/index.js`
3. Import in `CheatingDaddyApp.js` and add a case to the view router `renderCurrentView()`
4. Add navigation triggers (button clicks → `this.dispatchEvent(new CustomEvent(...))`)

---

## Platform-Specific Notes

### macOS

- Requires `entitlements.plist` for microphone, audio, and network access
- `SystemAudioDump` binary must be present in `src/assets/` and is bundled via `forge.config.js` `extraResource`
- Content protection works natively
- Window hides from Mission Control via Electron API

### Windows

- Uses `getDisplayMedia` with loopback audio (no extra binary needed)
- Window hides from Alt+Tab using `setSkipTaskbar(true)` + WS_EX_TOOLWINDOW workaround
- Squirrel installer creates taskbar shortcuts

### Linux

- Uses microphone input only (no system audio loopback)
- Built as AppImage via `@reforged/maker-appimage`
- Content protection support depends on compositor

---

## Security / Stealth Features

The app intentionally obscures itself from detection:

- **Process name randomization**: App process is renamed at startup to a system-sounding name (e.g., "System Manager", "Desktop Service")
- **Window title randomization**: Title changes every 30–60 seconds
- **Alt+Tab hiding**: Window excluded from task switchers on Windows/macOS
- **Content protection**: OS-level screenshot prevention enabled by default
- **User agent randomization**: Renderer is given a random but legitimate-looking UA

When modifying these features, be aware they interact with OS security and accessibility APIs. Test on target platforms.

---

## Common Gotchas

1. **`require()` in renderer**: The renderer runs in a sandboxed browser context. Do NOT use `require()` in any file under `src/components/` or `src/utils/renderer.js`. Use IPC to talk to the main process.

2. **Lit imports**: Lit is loaded from `src/assets/` as a plain JS module, not from `node_modules`. Always import from `../../assets/lit-core-2.7.4.min.js` (adjust relative path as needed).

3. **SystemAudioDump path**: On macOS, the binary path is resolved relative to `app.getAppPath()`. In development (`npm start`) it resolves to `src/assets/SystemAudioDump`; in production it uses `extraResource` from `forge.config.js`.

4. **Global shortcuts**: Defined in `window.js`. Shortcuts are re-registered on `update-keybinds` IPC. Always call `globalShortcut.unregisterAll()` before re-registering to avoid duplicates.

5. **Gemini Live session**: The session is stateful — it holds conversation context. On reconnect, `sendReconnectionContext()` replays history. Never create a new session without stopping the old one.

6. **Token rate limiting**: High-frequency screenshots can exhaust the Gemini token quota. The `TokenTracker` in `renderer.js` implements throttling. Do not bypass it.

7. **Content protection and DevTools**: Content protection prevents screen sharing of the app, which also affects screenshot-based debugging. Disable it temporarily via the Advanced settings if you need to capture the app window during development.
