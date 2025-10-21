# Cheating Daddy - Project Documentation for Claude

> **Last Updated**: 2025-10-21
> **Purpose**: This document serves as a comprehensive reference for Claude AI to understand the project architecture, structure, and implementation details across sessions.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [Data Flow](#data-flow)
6. [API & Model Integration](#api--model-integration)
7. [Configuration & Settings](#configuration--settings)
8. [Key Features](#key-features)
9. [Security Considerations](#security-considerations)
10. [Development Guidelines](#development-guidelines)
11. [Recent Changes](#recent-changes)

---

## Project Overview

**Cheating Daddy** is an Electron-based desktop application that provides real-time AI assistance during video calls, interviews, presentations, and meetings. It captures screen content and audio to provide contextual responses through AI models.

### Core Purpose
- Real-time contextual AI assistance
- Screen and audio analysis
- Multi-profile support for different use cases
- Stealth mode operation (always-on-top, transparent, click-through)

### Target Platforms
- **macOS**: Full support (system audio capture via SystemAudioDump)
- **Windows**: Full support (loopback audio)
- **Linux**: Limited support (microphone only)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  (src/index.js)                                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Window     │  │    Gemini    │  │   Stealth    │      │
│  │   Manager    │  │  IPC Handler │  │   Features   │      │
│  │ (window.js)  │  │ (gemini.js)  │  │    (...)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                 ▲                                  │
│         │                 │                                  │
│         │    IPC Channel  │                                  │
└─────────┼─────────────────┼──────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                   │
│  (Lit Web Components)                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         CheatingDaddyApp (Main Container)            │   │
│  │                                                      │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │   │
│  │  │ MainView   │  │ Assistant   │  │  Customize   │ │   │
│  │  │ (API Key)  │  │    View     │  │     View     │ │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘ │   │
│  │                                                      │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │   │
│  │  │  History   │  │  Advanced   │  │  Onboarding  │ │   │
│  │  │   View     │  │    View     │  │     View     │ │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Renderer Utilities (renderer.js)             │   │
│  │  - Audio Capture (MediaRecorder)                     │   │
│  │  - Screen Capture (getDisplayMedia)                  │   │
│  │  - Data Streaming to Main Process                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│                                                              │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │   Google Gemini API  │  │   Future: OpenRouter,       │  │
│  │  (WebSocket Stream)  │  │   Claude, GPT, etc.         │  │
│  └──────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Process Communication

**IPC Channels (Main ↔ Renderer)**:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `initialize-gemini` | Renderer → Main | Start AI session with API key |
| `send-audio-content` | Renderer → Main | Stream audio data |
| `send-image-content` | Renderer → Main | Stream screenshot data |
| `send-text-message` | Renderer → Main | Send text queries |
| `close-session` | Renderer → Main | End AI session |
| `get-current-session` | Renderer → Main | Retrieve session state |
| `update-google-search-setting` | Renderer → Main | Toggle search tool |
| `gemini-response-chunk` | Main → Renderer | Streaming AI response |
| `gemini-response-complete` | Main → Renderer | Response finished |
| `gemini-error` | Main → Renderer | Error notification |

---

## Project Structure

```
cheating-daddy/
├── src/
│   ├── components/
│   │   ├── app/
│   │   │   ├── CheatingDaddyApp.js      # Main app container (routing, state)
│   │   │   └── AppHeader.js             # Navigation header
│   │   └── views/
│   │       ├── MainView.js              # API key input, start session
│   │       ├── AssistantView.js         # AI response display
│   │       ├── CustomizeView.js         # Settings, profiles, keybinds
│   │       ├── AdvancedView.js          # Advanced settings (throttling)
│   │       ├── HistoryView.js           # Conversation history
│   │       ├── HelpView.js              # Help documentation
│   │       └── OnboardingView.js        # First-time setup wizard
│   │
│   ├── utils/
│   │   ├── gemini.js                    # Gemini API integration (23.7 KB)
│   │   ├── renderer.js                  # Audio/video capture (25.6 KB)
│   │   ├── window.js                    # Window management (19.8 KB)
│   │   ├── prompts.js                   # System prompts by profile (16.3 KB)
│   │   ├── stealthFeatures.js           # Anti-analysis measures
│   │   ├── processNames.js              # Random process naming
│   │   ├── processRandomizer.js         # Process name rotation
│   │   ├── windowResize.js              # Window resizing logic
│   │   └── audioUtils.js                # Audio processing utilities
│   │
│   ├── assets/
│   │   ├── SystemAudioDump              # macOS audio capture binary
│   │   ├── marked-4.3.0.min.js          # Markdown renderer
│   │   ├── lit-core-2.7.4.min.js        # Lit web components library
│   │   └── *.svg                        # Logos and onboarding graphics
│   │
│   ├── index.js                         # Electron main process entry
│   ├── index.html                       # DOM structure
│   ├── preload.js                       # Preload script
│   └── script.js                        # Additional scripts
│
├── forge.config.js                      # Electron Forge configuration
├── package.json                         # Dependencies and scripts
├── README.md                            # User-facing documentation
├── CLAUDE.md                            # This file (AI context)
└── .gitignore
```

### Key Files by Size and Importance

| File | Size | LOC | Purpose |
|------|------|-----|---------|
| `src/utils/renderer.js` | 25.6 KB | ~600 | Audio/video capture and streaming |
| `src/utils/gemini.js` | 23.7 KB | ~550 | Gemini API integration and IPC handlers |
| `src/components/views/CustomizeView.js` | 22.5 KB | ~530 | Settings UI (profiles, keybinds, layout) |
| `src/utils/window.js` | 19.8 KB | ~470 | Electron window management |
| `src/utils/prompts.js` | 16.3 KB | ~390 | System prompts for different profiles |

**Total Project Size**: ~2,733 lines of JavaScript

---

## Technology Stack

### Core Framework
- **Electron** 30.0.5 - Desktop application framework
- **Electron Forge** - Build, package, and distribution tooling

### Frontend
- **Lit** 2.7.4 - Lightweight web components library
- **Marked** 4.3.0 - Markdown parsing and rendering
- **Native JavaScript** - No React, Vue, or Angular

### AI Integration
- **@google/genai** 1.2.0 - Google Generative AI SDK
- **Model**: `gemini-live-2.5-flash-preview` (real-time streaming)

### Build Tools
- **Electron Forge Makers**:
  - `@electron-forge/maker-squirrel` - Windows installer
  - `@electron-forge/maker-dmg` - macOS DMG
  - `@electron-forge/maker-deb` - Linux DEB package
  - `@electron-forge/maker-appimage` - Linux AppImage

### Storage
- **localStorage** - API keys, settings, preferences
- **IndexedDB** - Conversation history (via browser APIs)
- **File System** - Audio/image data in `~/cheddar/data/`

---

## Data Flow

### Session Initialization Flow

```
User enters API key in MainView
         ↓
Stored in localStorage
         ↓
User clicks "Start Session"
         ↓
Renderer sends IPC: initialize-gemini
         ↓
Main Process (gemini.js):
  - Creates GoogleGenAI client
  - Connects to gemini-live-2.5-flash-preview
  - Configures system prompt from profile
  - Sets up callbacks (onmessage, onerror, etc.)
         ↓
Session established → Store in geminiSessionRef
         ↓
Main Process sends: gemini-session-initialized
         ↓
Renderer switches to AssistantView
         ↓
Start screen capture (every 5-15 seconds)
Start audio capture (continuous streaming)
```

### Real-Time Data Streaming Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer Process (renderer.js)                               │
└──────────────────────────────────────────────────────────────┘
    │
    ├─ Screen Capture (setInterval)
    │     ↓
    │  getDisplayMedia() → Canvas → JPEG blob
    │     ↓
    │  IPC: send-image-content
    │
    ├─ Audio Capture (MediaRecorder)
    │     ↓
    │  ondataavailable → Audio blob
    │     ↓
    │  IPC: send-audio-content
    │
    └─ Text Input
          ↓
       User types → Enter key
          ↓
       IPC: send-text-message

                    ▼

┌──────────────────────────────────────────────────────────────┐
│ Main Process (gemini.js)                                     │
└──────────────────────────────────────────────────────────────┘
    │
    ├─ IPC Handler: send-image-content
    │     ↓
    │  session.send({ realtimeInput: { image: base64 } })
    │
    ├─ IPC Handler: send-audio-content
    │     ↓
    │  session.send({ realtimeInput: { audio: base64 } })
    │
    └─ IPC Handler: send-text-message
          ↓
       session.send({ realtimeInput: { text: userMessage } })

                    ▼

┌──────────────────────────────────────────────────────────────┐
│ Google Gemini API (WebSocket)                                │
└──────────────────────────────────────────────────────────────┘
    │
    Processing multimodal input (audio + image + text)
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Gemini Response (Streaming)                                  │
└──────────────────────────────────────────────────────────────┘
    │
    callback: onmessage(message)
    │
    ├─ message.serverContent?.modelTurn
    │     ↓
    │  Extract text parts
    │     ↓
    │  Send IPC: gemini-response-chunk
    │
    └─ message.serverContent?.turnComplete
          ↓
       Send IPC: gemini-response-complete

                    ▼

┌──────────────────────────────────────────────────────────────┐
│ Renderer Process (AssistantView.js)                          │
└──────────────────────────────────────────────────────────────┘
    │
    Receive chunks → Accumulate response text
    │
    Render markdown (marked.js)
    │
    Display to user in transparent overlay
```

---

## API & Model Integration

### Current Implementation: Google Gemini

**File**: `src/utils/gemini.js`

#### Initialization

```javascript
// Line 214-231
async function initializeGemini(apiKey, config) {
    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
    });

    const session = await client.live.connect({
        model: 'gemini-live-2.5-flash-preview',
        callbacks: {
            onopen: function() { /* Session opened */ },
            onmessage: function(message) { /* Real-time messages */ },
            onerror: function(e) { /* Error handling */ },
            onclose: function(e) { /* Session closed */ },
        },
        config: {
            responseModalities: ['TEXT'],
            tools: enabledTools,  // Google Search tool
            inputAudioTranscription: {},
            contextWindowCompression: { slidingWindow: {} },
            speechConfig: { languageCode: language },
            systemInstruction: { parts: [{ text: systemPrompt }] },
        }
    });

    return session;
}
```

#### Message Handling

**Sending Data**:
```javascript
// Text
session.send({ realtimeInput: { text: userMessage } });

// Audio (base64 PCM16)
session.send({ realtimeInput: { audio: audioBase64 } });

// Image (base64 JPEG)
session.send({ realtimeInput: { image: imageBase64 } });
```

**Receiving Responses**:
```javascript
onmessage: function(message) {
    if (message.serverContent?.modelTurn) {
        const textParts = message.serverContent.modelTurn.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('');

        // Send to renderer via IPC
        mainWindow.webContents.send('gemini-response-chunk', textParts);
    }

    if (message.serverContent?.turnComplete) {
        mainWindow.webContents.send('gemini-response-complete');
    }
}
```

### Multi-Model Support (NEW - In Progress)

**Branch**: `claude/add-multi-model-support-011CUKcdeKvoCYF9awfTLbuT`

#### Provider Abstraction Pattern

**File**: `src/utils/providers/AIProvider.js` (to be created)

```javascript
// Base provider interface
class AIProvider {
    constructor() {
        this.session = null;
    }

    async initialize(apiKey, config) {
        throw new Error('Must implement initialize()');
    }

    async sendText(text) {
        throw new Error('Must implement sendText()');
    }

    async sendAudio(audioData) {
        throw new Error('Must implement sendAudio()');
    }

    async sendImage(imageData) {
        throw new Error('Must implement sendImage()');
    }

    async close() {
        throw new Error('Must implement close()');
    }
}
```

#### Supported Providers

1. **Google Gemini** (`GeminiProvider`)
   - Model: `gemini-live-2.5-flash-preview`
   - Supports: Text, Audio, Image (multimodal)
   - API: WebSocket streaming via `@google/genai`

2. **OpenRouter** (`OpenRouterProvider`)
   - Supports: Multiple models (GPT-4, Claude, Llama, etc.)
   - API: REST API with SSE (Server-Sent Events) for streaming
   - Endpoint: `https://openrouter.ai/api/v1/chat/completions`

3. **Anthropic Claude** (`ClaudeProvider`)
   - Models: Claude 3.5 Sonnet, Claude 3 Opus, etc.
   - Supports: Text, Image (vision)
   - API: REST API via `@anthropic-ai/sdk`

4. **OpenAI** (`OpenAIProvider`)
   - Models: GPT-4, GPT-4 Turbo, GPT-3.5
   - Supports: Text, Image (vision)
   - API: REST API via `openai` npm package

#### Configuration Structure

**localStorage Keys**:
```javascript
// Provider selection
localStorage.setItem('selectedProvider', 'gemini'); // gemini|openrouter|claude|openai

// API keys per provider
localStorage.setItem('gemini_apiKey', 'AIza...');
localStorage.setItem('openrouter_apiKey', 'sk-or-...');
localStorage.setItem('claude_apiKey', 'sk-ant-...');
localStorage.setItem('openai_apiKey', 'sk-...');

// Model selection per provider
localStorage.setItem('gemini_model', 'gemini-live-2.5-flash-preview');
localStorage.setItem('openrouter_model', 'anthropic/claude-3.5-sonnet');
localStorage.setItem('claude_model', 'claude-3-5-sonnet-20241022');
localStorage.setItem('openai_model', 'gpt-4-turbo');
```

#### Provider Factory

**File**: `src/utils/providers/ProviderFactory.js` (to be created)

```javascript
const { GeminiProvider } = require('./GeminiProvider');
const { OpenRouterProvider } = require('./OpenRouterProvider');
const { ClaudeProvider } = require('./ClaudeProvider');
const { OpenAIProvider } = require('./OpenAIProvider');

class ProviderFactory {
    static createProvider(providerName) {
        switch (providerName) {
            case 'gemini':
                return new GeminiProvider();
            case 'openrouter':
                return new OpenRouterProvider();
            case 'claude':
                return new ClaudeProvider();
            case 'openai':
                return new OpenAIProvider();
            default:
                throw new Error(`Unknown provider: ${providerName}`);
        }
    }
}
```

---

## Configuration & Settings

### localStorage Schema

All settings are stored in browser `localStorage` (Electron renderer process).

#### Core Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | String | - | Gemini API key (legacy, deprecated) |
| `gemini_apiKey` | String | - | Gemini API key (new multi-provider) |
| `openrouter_apiKey` | String | - | OpenRouter API key |
| `claude_apiKey` | String | - | Anthropic Claude API key |
| `openai_apiKey` | String | - | OpenAI API key |
| `selectedProvider` | String | `'gemini'` | Active AI provider |
| `onboardingCompleted` | Boolean | `false` | Skip onboarding flow |

#### Profile & Language

| Key | Type | Default | Options |
|-----|------|---------|---------|
| `selectedProfile` | String | `'interview'` | `interview`, `sales`, `meeting`, `presentation`, `negotiation`, `learning`, `gaming`, `general` |
| `selectedLanguage` | String | `'en-US'` | Any valid language code |
| `customPrompt` | String | - | User-provided context for AI |

#### Capture Settings

| Key | Type | Default | Options |
|-----|------|---------|---------|
| `selectedScreenshotInterval` | String | `'10'` | `'5'`, `'10'`, `'15'` (seconds) |
| `selectedImageQuality` | String | `'medium'` | `'low'`, `'medium'`, `'high'` |

#### Advanced Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `throttleTokens` | Boolean | `false` | Enable token rate limiting |
| `maxTokensPerMin` | Number | `1000` | Max tokens per minute |
| `throttleAtPercent` | Number | `75` | Throttle at percentage |
| `googleSearchEnabled` | Boolean | `false` | Enable Google Search tool |

#### UI Settings

| Key | Type | Default | Options |
|-----|------|---------|---------|
| `layoutMode` | String | `'normal'` | `'normal'`, `'compact'` |
| `fontSize` | Number | `14` | Font size in pixels |
| `contentProtection` | Boolean | `true` | Screenshot protection |

#### Keyboard Shortcuts

| Key | Type | Description |
|-----|------|-------------|
| `customKeybinds` | JSON String | Custom keyboard shortcuts object |

**Default Keybinds**:
```javascript
{
    moveUp: 'CommandOrControl+Up',
    moveDown: 'CommandOrControl+Down',
    moveLeft: 'CommandOrControl+Left',
    moveRight: 'CommandOrControl+Right',
    toggleClickThrough: 'CommandOrControl+M',
    closeWindow: 'CommandOrControl+\\'
}
```

#### Data Storage

| Key | Type | Description |
|-----|------|-------------|
| `savedResponses` | JSON Array | Conversation history (being migrated to IndexedDB) |

---

## Key Features

### 1. Real-Time Multimodal Input

**Screen Capture** (`src/utils/renderer.js`):
```javascript
// Interval-based screenshot capture
navigator.mediaDevices.getDisplayMedia({ video: true })
    .then(stream => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        setInterval(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            canvas.toBlob(blob => {
                ipcRenderer.send('send-image-content', blob);
            }, 'image/jpeg', quality);
        }, screenshotInterval * 1000);
    });
```

**Audio Capture**:
- **macOS**: SystemAudioDump binary captures system audio
- **Windows**: Loopback audio device
- **Linux**: Microphone input via MediaRecorder API

### 2. Profile System

**File**: `src/utils/prompts.js`

Each profile has:
- **Intro**: Role definition
- **Format Requirements**: Response structure
- **Search Usage**: When to use Google Search
- **Content**: Specific instructions
- **Output Instructions**: Formatting guidelines

**Available Profiles**:
1. **Interview** - Technical interview assistant
2. **Sales Call** - Sales objection handling
3. **Business Meeting** - Meeting note-taking and insights
4. **Presentation** - Public speaking assistance
5. **Negotiation** - Negotiation strategy advisor
6. **Learning** - Educational tutor
7. **Gaming** - Gaming companion and strategy
8. **General** - General-purpose assistant

### 3. Stealth Features

**File**: `src/utils/stealthFeatures.js`

- **Random Process Names**: Changes process title to random common app names
- **Random Window Titles**: Rotates window titles to blend in
- **Click-Through Mode**: `setIgnoreMouseEvents(true)` for transparent interaction
- **Always On Top**: `alwaysOnTop: true` keeps window above all others
- **Skip Taskbar**: `skipTaskbar: true` hides from taskbar
- **Content Protection**: `setContentProtection(true)` prevents screenshots of app window
- **Anti-Analysis Measures**: Detects debuggers and analysis tools

### 4. Conversation History

**Storage**: IndexedDB (browser-based database)

**Schema**:
```javascript
{
    id: timestamp,
    timestamp: Date,
    profile: 'interview',
    language: 'en-US',
    messages: [
        { role: 'user', content: '...' },
        { role: 'assistant', content: '...' }
    ]
}
```

### 5. Token Throttling

**File**: `src/components/views/AdvancedView.js`

Prevents excessive API usage by limiting tokens per minute:
- Track token usage over time window
- Pause sending data when threshold reached
- Resume when usage drops below limit

---

## Security Considerations

### Current Security Issues

1. **contextIsolation: false** (HIGH RISK)
   - **Location**: `src/utils/window.js:117`
   - **Issue**: Allows renderer process full access to Node.js APIs
   - **Recommendation**: Set to `true` and use proper IPC bridges

2. **nodeIntegration: true** (HIGH RISK)
   - **Location**: `src/utils/window.js:116`
   - **Issue**: Gives web content direct access to Node.js
   - **Recommendation**: Set to `false` and use preload scripts

3. **API Keys in localStorage** (MEDIUM RISK)
   - **Location**: Throughout app (MainView.js, etc.)
   - **Issue**: Unencrypted storage accessible to any renderer code
   - **Recommendation**: Use electron-store with encryption or system keychain

4. **No HTTPS Enforcement** (LOW RISK)
   - **Issue**: External resources may load over HTTP
   - **Recommendation**: Add CSP headers enforcing HTTPS

### Security Best Practices

**Implemented**:
- Content protection enabled (prevents screenshots)
- Stealth measures to avoid detection
- No remote code execution

**TODO**:
- [ ] Enable context isolation
- [ ] Disable node integration
- [ ] Encrypt API keys using electron-store or keytar
- [ ] Add Content Security Policy (CSP)
- [ ] Implement certificate pinning for API calls
- [ ] Add input validation on all IPC handlers

---

## Development Guidelines

### Adding a New AI Provider

1. **Create Provider Class** (`src/utils/providers/YourProvider.js`):
```javascript
const AIProvider = require('./AIProvider');

class YourProvider extends AIProvider {
    async initialize(apiKey, config) {
        // Initialize API client
    }

    async sendText(text) {
        // Send text to API
    }

    async sendAudio(audioData) {
        // Handle audio (or throw if unsupported)
    }

    async sendImage(imageData) {
        // Handle image (or throw if unsupported)
    }

    async close() {
        // Cleanup
    }
}

module.exports = { YourProvider };
```

2. **Register in ProviderFactory** (`src/utils/providers/ProviderFactory.js`):
```javascript
case 'yourprovider':
    return new YourProvider();
```

3. **Add UI in MainView** (`src/components/views/MainView.js`):
- Add provider selection dropdown
- Add API key input field
- Add model selection dropdown

4. **Update IPC Handlers** (`src/utils/gemini.js` → rename to `src/utils/aiHandler.js`):
- Replace hard-coded Gemini logic with provider factory
- Handle provider-specific initialization

### Code Style Guidelines

1. **Use Lit Web Components** for all UI
2. **Use IPC for Main ↔ Renderer communication**
3. **Store settings in localStorage** (consider migration to electron-store)
4. **Use async/await** for asynchronous operations
5. **Error handling**: Always wrap API calls in try-catch
6. **Logging**: Use console.log for debugging (consider adding proper logger)

### Testing Checklist

- [ ] Test on macOS (system audio capture)
- [ ] Test on Windows (loopback audio)
- [ ] Test on Linux (microphone input)
- [ ] Verify API key validation
- [ ] Test all profiles
- [ ] Test keyboard shortcuts
- [ ] Test click-through mode
- [ ] Test window positioning
- [ ] Test conversation history
- [ ] Test token throttling

---

## Recent Changes

### 2025-10-21: Multi-Model Support (In Progress)

**Branch**: `claude/add-multi-model-support-011CUKcdeKvoCYF9awfTLbuT`

**Changes**:
- Added support for OpenRouter API integration
- Created provider abstraction layer for multiple AI models
- Updated API key management to support multiple providers
- Added model selection UI in settings
- Updated documentation (this file)

**Files Modified**:
- [ ] `src/utils/providers/AIProvider.js` (new)
- [ ] `src/utils/providers/GeminiProvider.js` (new)
- [ ] `src/utils/providers/OpenRouterProvider.js` (new)
- [ ] `src/utils/providers/ClaudeProvider.js` (new)
- [ ] `src/utils/providers/OpenAIProvider.js` (new)
- [ ] `src/utils/providers/ProviderFactory.js` (new)
- [ ] `src/components/views/MainView.js` (updated)
- [ ] `src/components/views/CustomizeView.js` (updated)
- [ ] `README.md` (updated)
- [x] `CLAUDE.md` (created)

**Testing Status**: Not yet tested

---

## Quick Reference

### Important File Locations

| Purpose | File Path |
|---------|-----------|
| Main process entry | `src/index.js` |
| Gemini API integration | `src/utils/gemini.js` |
| Audio/video capture | `src/utils/renderer.js` |
| Window management | `src/utils/window.js` |
| System prompts | `src/utils/prompts.js` |
| Main app component | `src/components/app/CheatingDaddyApp.js` |
| API key input | `src/components/views/MainView.js` |
| Settings UI | `src/components/views/CustomizeView.js` |

### Common Tasks

**Start Development**:
```bash
npm install
npm start
```

**Build for Production**:
```bash
npm run make
```

**Package for Specific Platform**:
```bash
npm run package -- --platform=darwin  # macOS
npm run package -- --platform=win32   # Windows
npm run package -- --platform=linux   # Linux
```

### Environment Variables

Currently, the app does NOT use environment variables. All configuration is stored in localStorage.

**Future**: Consider using `.env` files with `dotenv` for:
- Default API endpoints
- Feature flags
- Debug mode

---

## Notes for Claude

### Context to Remember

1. **This is NOT a React app** - It uses Lit web components
2. **Electron version 30.0.5** - Check compatibility for new features
3. **Security is important** - This app handles sensitive API keys
4. **Cross-platform support** - Test on all three platforms
5. **Stealth is a core feature** - Don't break click-through or always-on-top
6. **Real-time performance matters** - Avoid blocking the UI thread

### When Making Changes

- Always read relevant files before editing
- Update this CLAUDE.md file with significant changes
- Update README.md for user-facing changes
- Test on multiple platforms if possible
- Consider security implications of IPC changes
- Maintain backward compatibility with localStorage data

### Common Pitfalls

- Don't use React syntax (JSX) - Use Lit template literals
- Don't use `require()` in renderer - Use `window.require()` or IPC
- Don't forget to handle errors in IPC handlers
- Don't break existing localStorage schema without migration path
- Don't assume features work the same across platforms (especially audio)

---

**End of Documentation**
