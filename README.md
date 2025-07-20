<img src="/src/assets/logo.png" alt="uwu" width="200"/>

# Cheating Daddy

> [!NOTE]  
> Use latest MacOS and Windows version, older versions have limited support

> [!NOTE]  
> During testing it wont answer if you ask something, you need to simulate interviewer asking question, which it will answer

A real-time AI assistant that provides contextual help during video calls, interviews, presentations, and meetings using screen capture and audio analysis.

## Features

- **Multi-Provider AI Assistance**: Real-time help powered by multiple AI providers:
  - **Google Gemini 2.0 Flash Live** - Fast and contextual responses
  - **Anthropic Claude** - Advanced reasoning and analysis
  - **OpenAI ChatGPT** - Versatile conversation capabilities
  - **Mistral AI** - High-performance language models
  - **Groq** - Ultra-fast inference speeds
  - **XAI** - Next-generation AI capabilities
  - **OpenRouter** - Unified access to multiple AI models
- **Screen & Audio Capture**: Analyzes what you see and hear for contextual responses
- **Multiple Profiles**: Interview, Sales Call, Business Meeting, Presentation, Negotiation
- **Transparent Overlay**: Always-on-top window that can be positioned anywhere
- **Click-through Mode**: Make window transparent to clicks when needed
- **Cross-platform**: Works on macOS, Windows, and Linux (kinda, dont use, just for testing rn)

## Setup

1. **Get API Keys**: Choose your preferred AI provider(s):
   - **Google Gemini**: Visit [Google AI Studio](https://aistudio.google.com/apikey)
   - **Anthropic Claude**: Visit [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI ChatGPT**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Mistral AI**: Visit [Mistral AI Platform](https://console.mistral.ai/)
   - **Groq**: Visit [Groq Console](https://console.groq.com/)
   - **XAI**: Visit [XAI Platform](https://x.ai/)
   - **OpenRouter**: Visit [OpenRouter](https://openrouter.ai/)
2. **Install Dependencies**: `npm install`
3. **Run the App**: `npm start`

## Usage

1. Enter your preferred AI provider API key in the main window
2. Select your AI provider from the dropdown menu
3. Choose your profile and language in settings
4. Click "Start Session" to begin
5. Position the window using keyboard shortcuts
6. The AI will provide real-time assistance based on your screen and what interview asks

## Supported AI Providers

| Provider | Best For | Speed | Cost |
|----------|----------|-------|------|
| **Google Gemini** | General assistance, fast responses | ⚡⚡⚡ | Low |
| **Anthropic Claude** | Complex reasoning, detailed analysis | ⚡⚡ | Medium |
| **OpenAI ChatGPT** | Versatile conversations, coding help | ⚡⚡ | Medium |
| **Mistral AI** | High-performance tasks, multilingual | ⚡⚡⚡ | Low |
| **Groq** | Ultra-fast responses, real-time needs | ⚡⚡⚡⚡ | Medium |
| **XAI** | Advanced AI capabilities, cutting-edge | ⚡⚡ | High |
| **OpenRouter** | Multiple models, unified access | ⚡⚡ | Variable |

## Keyboard Shortcuts

- **Window Movement**: `Ctrl/Cmd + Arrow Keys` - Move window
- **Click-through**: `Ctrl/Cmd + M` - Toggle mouse events
- **Close/Back**: `Ctrl/Cmd + \` - Close window or go back
- **Send Message**: `Enter` - Send text to AI
- **Switch AI Provider**: `Ctrl/Cmd + P` - Quick provider selection

## Audio Capture

- **macOS**: [SystemAudioDump](https://github.com/Mohammed-Yasin-Mulla/Sound) for system audio
- **Windows**: Loopback audio capture
- **Linux**: Microphone input

## Requirements

- Electron-compatible OS (macOS, Windows, Linux)
- API key from your chosen AI provider
- Screen recording permissions
- Microphone/audio permissions
