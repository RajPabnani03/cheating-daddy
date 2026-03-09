# CLAUDE.md — Cheating Daddy Codebase Guide

## Project Overview

**Cheating Daddy** is an Electron desktop application that provides real-time AI assistance during interviews, meetings, sales calls, and presentations. It captures the user's screen and audio, sends them to the Google Gemini 2.0 Flash Live API, and displays AI-generated responses in a transparent, always-on-top overlay window.

- **License:** GPL-3.0
- **Version:** 0.4.0
- **Entry point:** `src/index.js` (Electron main process)
- **Framework:** Electron 30 + Lit (Web Components) + Google GenAI SDK

---

## Repository Structure

```
cheating-daddy/
├── src/
│   ├── index.js              # Electron main process: window creation, IPC, startup
│   ├── index.html            # HTML shell: CSS vars, theme, component bootstrap
│   ├── preload.js            # Preload script for renderer context
│   ├── audioUtils.js         # PCM/WAV conversion and audio buffer analysis
│   ├── assets/
│   │   ├── logo.*            # App icons (png, icns, ico)
│   │   ├── marked-4.3.0.min.js        # Markdown parser (vendored)
│   │   ├── lit-all-2.7.4.min.js       # Lit framework (vendored)
│   │   ├── lit-core-2.7.4.min.js      # Lit core (vendored)
│   │   ├── onboarding/       # SVG assets for onboarding screens
│   │   └── SystemAudioDump   # macOS binary for system audio capture
│   ├── components/
│   │   ├── index.js          # Re-exports all components
│   │   ├── app/
│   │   │   ├── CheatingDaddyApp.js    # Root app component, routing, global state
│   │   │   └── AppHeader.js           # Header/nav bar component
│   │   └── views/
│   │       ├── MainView.js            # Landing screen, API key entry
│   │       ├── OnboardingView.js      # 5-step onboarding tutorial
│   │       ├── AssistantView.js       # Live AI response display
│   │       ├── CustomizeView.js       # Settings: profile, language, quality
│   │       ├── HistoryView.js         # Past conversation browser (IndexedDB)
│   │       ├── AdvancedView.js        # Advanced settings, keybinds, token stats
│   │       └── HelpView.js            # Help docs
│   └── utils/
│       ├── gemini.js          # Gemini Live API session management
│       ├── window.js          # Window creation, shortcuts, desktop capture
│       ├── renderer.js        # Screen/audio capture, token tracking
│       ├── stealthFeatures.js # Anti-detection: taskbar hiding, title randomization
│       ├── processNames.js    # Random legitimate-looking process name pool
│       ├── processRandomizer.js # Process name initialization at startup
│       ├── prompts.js         # System prompts per profile
│       └── windowResize.js    # Window resizing utilities
├── forge.config.js            # Electron Forge build configuration
├── entitlements.plist         # macOS sandbox entitlements
├── .prettierrc                # Prettier formatting rules
├── .prettierignore            # Prettier ignore (src/assets, node_modules)
├── package.json               # Dependencies and npm scripts
└── README.md                  # User-facing documentation
```

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
```
Uses `electron-forge start` with hot reload.

### Build / Package
```bash
npm run package   # Package without installer
npm run make      # Create platform-specific distributables
npm run publish   # Publish packages
```

**Output formats by platform:**
- **macOS:** DMG disk image
- **Windows:** Squirrel installer (desktop + start menu shortcuts)
- **Linux:** AppImage via `@reforged/maker-appimage`

### Linting / Formatting
- Prettier is configured (`.prettierrc`) but **linting is currently disabled** in `package.json`.
- Format code manually with: `npx prettier --write src/`
- Formatting rules: 4-space indent, single quotes, semicolons, 150-char line width, LF line endings.
- **No test suite exists.** All testing is manual.

---

## Architecture

### Electron Process Model

```
Main Process (Node.js)                Renderer Process (Chromium)
─────────────────────────────         ────────────────────────────
src/index.js                          src/index.html
  └─ utils/window.js                    └─ components/app/CheatingDaddyApp.js
       └─ utils/stealthFeatures.js           └─ components/views/*.js
       └─ utils/processRandomizer.js
  └─ utils/gemini.js                  src/utils/renderer.js
  └─ IPC handlers                       └─ Screen capture (getDisplayMedia)
                                         └─ Audio capture (Web Audio API)
```

- **Main ↔ Renderer communication:** Electron IPC (`ipcMain` / `ipcRenderer`) via `preload.js`.
- **No context isolation** is currently enforced — keep this in mind for security reviews.
- The window is transparent, always-on-top, and click-through by default.

### UI — Lit Web Components

All UI is built with [Lit](https://lit.dev/) (`LitElement`) as vanilla web components. Libraries are **vendored** in `src/assets/` — do not use npm imports for Lit in components.

- Import Lit from: `'../assets/lit-all-2.7.4.min.js'` (renderer context)
- Component template returns `html\`...\`` tagged template literals.
- Styles use `css\`...\`` and are encapsulated via Shadow DOM.
- State uses `@property()` and `@state()` decorators.

**View routing** is handled entirely in `CheatingDaddyApp.js` via a `currentView` property. There is no router library.

### State Management

| Storage | What lives there |
|---|---|
| `LitElement` properties | Ephemeral UI state (current view, streaming status) |
| `localStorage` | User preferences (API key, profile, language, layout mode, keybinds) |
| `IndexedDB` | Conversation history (sessions and turns) |
| Module-level variables | Active Gemini session state in `gemini.js` |

### Gemini Integration (`src/utils/gemini.js`)

- Uses `@google/genai` SDK with the **Gemini 2.0 Flash Live** model.
- Establishes a persistent bidirectional streaming session.
- Sends periodic base64-encoded screenshots and PCM audio chunks.
- Supports reconnection (up to 3 attempts on disconnect).
- Integrates Google Search as a Gemini tool for real-time information.
- Each conversation turn is saved to IndexedDB.
- System prompt is selected based on the active profile (see `src/utils/prompts.js`).

### Screen & Audio Capture (`src/utils/renderer.js`)

- **Screen:** `desktopCapturer` (main) → `getDisplayMedia()` (renderer) → Canvas → base64 JPEG
  - Configurable intervals: 5s, 10s, 30s, 60s, or manual trigger
  - Configurable quality: low, medium, high
- **Audio (microphone):** `getUserMedia` → Web Audio API → PCM at 24kHz
- **Audio (system, macOS):** `SystemAudioDump` binary (extra resource in ASAR)
- **Token tracking:** Images estimated at 258 tokens (≤384px) or tiled 768px chunks; audio at 32 tokens/sec. Capture is throttled near the token limit.

---

## Key Conventions

### Adding a New View

1. Create `src/components/views/MyView.js` as a `LitElement` subclass.
2. Export it from `src/components/index.js`.
3. Add a case in `CheatingDaddyApp.js` `renderCurrentView()` method.
4. Add navigation trigger (button/event) in the appropriate existing view.

### Adding a New Profile

1. Add a new entry to the profiles object in `src/utils/prompts.js`.
2. Provide a concise system prompt — responses should be **1–3 sentences**, markdown-formatted, and ready to speak aloud.
3. Add the profile option to `CustomizeView.js` selector.

### IPC Handlers

- Define handlers in `src/index.js` with `ipcMain.handle('channel-name', handler)`.
- Expose via `preload.js` using `contextBridge.exposeInMainWorld`.
- Call from renderer via `window.electronAPI.methodName()`.

### Stealth Features

`src/utils/stealthFeatures.js` applies anti-detection measures. These are gated behind a user-togglable setting (`stealthModeEnabled`). When modifying stealth behavior:
- Keep all stealth logic inside `stealthFeatures.js`.
- Respect the user toggle — do not apply stealth unconditionally.

### Process Name Randomization

`src/utils/processNames.js` contains pools of prefix/suffix/company name fragments used to generate realistic-looking process names. The name is fixed per session (initialized once in `processRandomizer.js`).

---

## Dependencies

### Runtime
| Package | Purpose |
|---|---|
| `@google/genai` | Google Gemini 2.0 Flash Live API client |

### Dev / Build
| Package | Purpose |
|---|---|
| `electron` | Desktop app runtime |
| `electron-forge/*` | Build, package, and publish toolchain |
| `@electron/fuses` | Security hardening (RunAsNode off, ASAR integrity on) |
| `electron-squirrel-startup` | Windows installer startup hook |

Lit and Marked are **vendored** as static files in `src/assets/` — not npm packages.

---

## Platform Notes

| Platform | System Audio | Packaging | Notes |
|---|---|---|---|
| macOS | `SystemAudioDump` binary | DMG | Entitlements required (`entitlements.plist`); signing/notarization config exists but is commented out |
| Windows | Web Audio API | Squirrel installer | Squirrel creates desktop + start menu shortcuts |
| Linux | Web Audio API | AppImage | Beta support; AppImage via `@reforged/maker-appimage` |

---

## What Does NOT Exist (as of v0.4.0)

- No automated tests (no Jest, Mocha, Vitest, etc.)
- No CI/CD pipeline (no GitHub Actions or similar)
- No `.env` file — API key entered in UI, stored in localStorage
- No linting (disabled in `package.json`)
- No TypeScript — plain ES modules throughout
- No server-side component — fully local Electron app
