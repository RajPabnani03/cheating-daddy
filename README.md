<img src="/src/assets/logo.png" alt="uwu" width="200"/>

# Cheating Daddy

> [!NOTE]  
> Use latest MacOS and Windows version, older versions have limited support

> [!NOTE]  
> During testing it wont answer if you ask something, you need to simulate interviewer asking question, which it will answer

A real-time AI assistant that provides contextual help during video calls, interviews, presentations, and meetings using screen capture and audio analysis.

## Features

- **Multi-Model AI Support**: Choose from multiple AI providers:
  - **Google Gemini**: Real-time multimodal streaming with audio support
  - **OpenRouter**: Access to Claude, GPT-4, Llama, and 20+ other models
  - **Anthropic Claude**: Claude 3.5 Sonnet and other Claude models
  - **OpenAI**: GPT-4o, GPT-4 Turbo, and GPT-3.5
- **Screen & Audio Capture**: Analyzes what you see and hear for contextual responses
- **Multiple Profiles**: Interview, Sales Call, Business Meeting, Presentation, Negotiation
- **Transparent Overlay**: Always-on-top window that can be positioned anywhere
- **Click-through Mode**: Make window transparent to clicks when needed
- **Cross-platform**: Works on macOS, Windows, and Linux (kinda, dont use, just for testing rn)

## Setup

1. **Get an API Key** from your preferred provider:
   - **Google Gemini**: [Google AI Studio](https://aistudio.google.com/apikey) (Recommended for real-time audio)
   - **OpenRouter**: [OpenRouter Keys](https://openrouter.ai/keys)
   - **Anthropic Claude**: [Anthropic Console](https://console.anthropic.com/settings/keys)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Install Dependencies**: `npm install`
3. **Run the App**: `npm start`

## Usage

1. Select your AI provider and model from the dropdowns
2. Enter your API key for the selected provider
3. Choose your profile and language in settings
4. Click "Start Session" to begin (Cmd/Ctrl + Enter)
5. Position the window using keyboard shortcuts
6. The AI will provide real-time assistance based on your screen and audio input

## Keyboard Shortcuts

- **Window Movement**: `Ctrl/Cmd + Arrow Keys` - Move window
- **Click-through**: `Ctrl/Cmd + M` - Toggle mouse events
- **Close/Back**: `Ctrl/Cmd + \` - Close window or go back
- **Send Message**: `Enter` - Send text to AI

## Audio Capture

- **macOS**: [SystemAudioDump](https://github.com/Mohammed-Yasin-Mulla/Sound) for system audio
- **Windows**: Loopback audio capture
- **Linux**: Microphone input

## Requirements

- Electron-compatible OS (macOS, Windows, Linux)
- API key from at least one supported provider (Gemini, OpenRouter, Claude, or OpenAI)
- Screen recording permissions
- Microphone/audio permissions

## Provider Capabilities

| Provider | Text | Image | Audio | Streaming | Notes |
|----------|------|-------|-------|-----------|-------|
| **Google Gemini** | ✅ | ✅ | ✅ | ✅ | Best for real-time audio support |
| **OpenRouter** | ✅ | ✅* | ❌ | ✅ | Access to 20+ models (*vision depends on model) |
| **Anthropic Claude** | ✅ | ✅ | ❌ | ✅ | Excellent for complex reasoning |
| **OpenAI** | ✅ | ✅* | ❌ | ✅ | GPT-4o recommended (*vision depends on model) |

**Note**: Audio input is only supported by Google Gemini. Other providers support text and image (screen capture) input.
