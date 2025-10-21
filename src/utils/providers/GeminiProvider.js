const { GoogleGenAI } = require('@google/genai');
const { AIProvider } = require('./AIProvider');
const { getSystemPrompt } = require('../prompts');

/**
 * Google Gemini AI Provider
 * Supports real-time multimodal streaming (text, audio, image)
 */
class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.providerName = 'gemini';
        this.client = null;
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 3;
        this.reconnectionDelay = 2000;
        this.lastSessionParams = null;
        this.messageBuffer = '';
    }

    async initialize(apiKey, config) {
        try {
            this.client = new GoogleGenAI({
                vertexai: false,
                apiKey: apiKey,
            });

            // Store session params for reconnection
            this.lastSessionParams = {
                apiKey,
                config,
            };

            const systemPrompt = getSystemPrompt(
                config.profile || 'interview',
                config.customPrompt || '',
                config.googleSearchEnabled || false
            );

            // Build tools array
            const enabledTools = [];
            if (config.googleSearchEnabled) {
                enabledTools.push({ googleSearch: {} });
            }

            this.session = await this.client.live.connect({
                model: config.model || 'gemini-live-2.5-flash-preview',
                callbacks: {
                    onopen: () => {
                        console.log('[GeminiProvider] Session opened');
                        this.reconnectionAttempts = 0;
                        this._triggerOpen();
                    },
                    onmessage: (message) => {
                        this._handleMessage(message);
                    },
                    onerror: (e) => {
                        console.error('[GeminiProvider] Error:', e.message);

                        const isApiKeyError =
                            e.message &&
                            (e.message.includes('API key not valid') ||
                                e.message.includes('invalid API key') ||
                                e.message.includes('authentication failed') ||
                                e.message.includes('unauthorized'));

                        if (isApiKeyError) {
                            this.lastSessionParams = null;
                            this.reconnectionAttempts = this.maxReconnectionAttempts;
                        }

                        this._triggerError(e.message);
                    },
                    onclose: (e) => {
                        console.log('[GeminiProvider] Session closed:', e.reason);

                        const isApiKeyError =
                            e.reason &&
                            (e.reason.includes('API key not valid') ||
                                e.reason.includes('invalid API key') ||
                                e.reason.includes('authentication failed') ||
                                e.reason.includes('unauthorized'));

                        if (isApiKeyError) {
                            this.lastSessionParams = null;
                            this.reconnectionAttempts = this.maxReconnectionAttempts;
                        }

                        // Auto-reconnect if enabled
                        if (this.lastSessionParams && this.reconnectionAttempts < this.maxReconnectionAttempts) {
                            this._attemptReconnection();
                        } else {
                            this._triggerClose(e.reason);
                        }
                    },
                },
                config: {
                    responseModalities: ['TEXT'],
                    tools: enabledTools,
                    inputAudioTranscription: {},
                    contextWindowCompression: { slidingWindow: {} },
                    speechConfig: { languageCode: config.language || 'en-US' },
                    systemInstruction: {
                        parts: [{ text: systemPrompt }],
                    },
                },
            });

            console.log('[GeminiProvider] Session initialized successfully');
            return { success: true };
        } catch (error) {
            console.error('[GeminiProvider] Failed to initialize:', error);
            return { success: false, error: error.message };
        }
    }

    async _attemptReconnection() {
        if (!this.lastSessionParams || this.reconnectionAttempts >= this.maxReconnectionAttempts) {
            console.log('[GeminiProvider] Max reconnection attempts reached');
            return false;
        }

        this.reconnectionAttempts++;
        console.log(`[GeminiProvider] Attempting reconnection ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}...`);

        await new Promise(resolve => setTimeout(resolve, this.reconnectionDelay));

        try {
            const result = await this.initialize(
                this.lastSessionParams.apiKey,
                this.lastSessionParams.config
            );

            if (result.success) {
                console.log('[GeminiProvider] Reconnected successfully');
                return true;
            }
        } catch (error) {
            console.error(`[GeminiProvider] Reconnection attempt ${this.reconnectionAttempts} failed:`, error);
        }

        if (this.reconnectionAttempts < this.maxReconnectionAttempts) {
            return this._attemptReconnection();
        }

        return false;
    }

    _handleMessage(message) {
        // Handle transcription input
        if (message.serverContent?.inputTranscription?.text) {
            const transcription = message.serverContent.inputTranscription.text;
            console.log('[GeminiProvider] Transcription:', transcription);
            // Could add transcription callback here if needed
        }

        // Handle AI model response
        if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                    this.messageBuffer += part.text;
                    this._triggerMessage(this.messageBuffer, false);
                }
            }
        }

        // Handle generation complete
        if (message.serverContent?.generationComplete) {
            this._triggerMessage(this.messageBuffer, true);
            this.messageBuffer = '';
        }

        // Handle turn complete
        if (message.serverContent?.turnComplete) {
            // Turn complete notification
        }
    }

    async sendText(text) {
        if (!this.session) {
            return { success: false, error: 'No active session' };
        }

        try {
            await this.session.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('[GeminiProvider] Error sending text:', error);
            return { success: false, error: error.message };
        }
    }

    async sendAudio(audioData, mimeType) {
        if (!this.session) {
            return { success: false, error: 'No active session' };
        }

        try {
            await this.session.sendRealtimeInput({
                audio: {
                    data: audioData,
                    mimeType: mimeType || 'audio/pcm;rate=24000',
                },
            });
            return { success: true };
        } catch (error) {
            console.error('[GeminiProvider] Error sending audio:', error);
            return { success: false, error: error.message };
        }
    }

    async sendImage(imageData, mimeType) {
        if (!this.session) {
            return { success: false, error: 'No active session' };
        }

        try {
            await this.session.sendRealtimeInput({
                media: {
                    data: imageData,
                    mimeType: mimeType || 'image/jpeg',
                },
            });
            return { success: true };
        } catch (error) {
            console.error('[GeminiProvider] Error sending image:', error);
            return { success: false, error: error.message };
        }
    }

    async close() {
        try {
            // Clear reconnection params
            this.lastSessionParams = null;
            this.reconnectionAttempts = this.maxReconnectionAttempts;

            if (this.session) {
                await this.session.close();
                this.session = null;
            }
            return { success: true };
        } catch (error) {
            console.error('[GeminiProvider] Error closing session:', error);
            return { success: false, error: error.message };
        }
    }

    getCapabilities() {
        return {
            supportsText: true,
            supportsAudio: true,
            supportsImage: true,
            supportsStreaming: true,
            supportsTools: true,
        };
    }

    getAvailableModels() {
        return [
            {
                id: 'gemini-live-2.5-flash-preview',
                name: 'Gemini 2.5 Flash (Live Preview)',
                description: 'Real-time multimodal streaming model',
            },
            {
                id: 'gemini-2.0-flash-exp',
                name: 'Gemini 2.0 Flash (Experimental)',
                description: 'Latest experimental flash model',
            },
        ];
    }
}

module.exports = { GeminiProvider };
