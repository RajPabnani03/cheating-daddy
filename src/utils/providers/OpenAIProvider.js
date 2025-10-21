const { AIProvider } = require('./AIProvider');
const { getSystemPrompt } = require('../prompts');
const https = require('https');

/**
 * OpenAI AI Provider
 * Supports GPT models via OpenAI API
 * Uses streaming for real-time responses
 */
class OpenAIProvider extends AIProvider {
    constructor() {
        super();
        this.providerName = 'openai';
        this.apiKey = null;
        this.model = null;
        this.conversationHistory = [];
        this.systemPrompt = '';
        this.isActive = false;

        // Image batching
        this.imageQueue = [];
        this.lastImageSentTime = 0;
        this.imageSendInterval = 5000;
    }

    async initialize(apiKey, config) {
        try {
            this.apiKey = apiKey;
            this.model = config.model || 'gpt-4o';
            this.isActive = true;

            this.systemPrompt = getSystemPrompt(
                config.profile || 'interview',
                config.customPrompt || '',
                config.googleSearchEnabled || false
            );

            // Initialize conversation with system message
            this.conversationHistory = [
                {
                    role: 'system',
                    content: this.systemPrompt,
                },
            ];

            console.log('[OpenAIProvider] Initialized with model:', this.model);
            this._triggerOpen();

            return { success: true };
        } catch (error) {
            console.error('[OpenAIProvider] Failed to initialize:', error);
            return { success: false, error: error.message };
        }
    }

    async sendText(text) {
        if (!this.isActive) {
            return { success: false, error: 'No active session' };
        }

        try {
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: text.trim(),
            });

            // Send request and get streaming response
            await this._sendRequest();

            return { success: true };
        } catch (error) {
            console.error('[OpenAIProvider] Error sending text:', error);
            return { success: false, error: error.message };
        }
    }

    async sendAudio(audioData, mimeType) {
        // OpenAI doesn't support audio in chat completions
        // Would need to use Whisper API for transcription first
        return {
            success: false,
            error: 'Audio input not supported by OpenAI Chat API. Please use text or image input.'
        };
    }

    async sendImage(imageData, mimeType) {
        if (!this.isActive) {
            return { success: false, error: 'No active session' };
        }

        try {
            // Check if model supports vision
            const modelInfo = this._getModelInfo(this.model);
            if (!modelInfo.supportsVision) {
                return {
                    success: false,
                    error: `Model ${this.model} does not support image input. Please use gpt-4o or gpt-4-turbo.`
                };
            }

            // Add image to queue
            this.imageQueue.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType || 'image/jpeg'};base64,${imageData}`,
                },
                timestamp: Date.now(),
            });

            // Send images if enough time has passed
            const now = Date.now();
            if (now - this.lastImageSentTime >= this.imageSendInterval) {
                await this._sendQueuedImages();
                this.lastImageSentTime = now;
            }

            return { success: true };
        } catch (error) {
            console.error('[OpenAIProvider] Error queueing image:', error);
            return { success: false, error: error.message };
        }
    }

    async _sendQueuedImages() {
        if (this.imageQueue.length === 0) return;

        try {
            // Take the most recent image
            const latestImage = this.imageQueue[this.imageQueue.length - 1];
            this.imageQueue = [];

            // Build multimodal message with image
            const content = [
                {
                    type: 'text',
                    text: 'Analyze the current screen. What do you see that might be relevant to assist?',
                },
                latestImage,
            ];

            this.conversationHistory.push({
                role: 'user',
                content: content,
            });

            await this._sendRequest();
        } catch (error) {
            console.error('[OpenAIProvider] Error sending queued images:', error);
        }
    }

    async _sendRequest() {
        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: this.model,
                messages: this.conversationHistory,
                stream: true,
            });

            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                },
            };

            const req = https.request(options, (res) => {
                let buffer = '';
                let assistantMessage = '';

                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();

                            if (data === '[DONE]') {
                                // Stream complete
                                this.conversationHistory.push({
                                    role: 'assistant',
                                    content: assistantMessage,
                                });
                                this._triggerMessage(assistantMessage, true);
                                resolve();
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta?.content;

                                if (delta) {
                                    assistantMessage += delta;
                                    this._triggerMessage(assistantMessage, false);
                                }

                                // Check for errors
                                if (parsed.error) {
                                    this._triggerError(parsed.error.message);
                                    reject(new Error(parsed.error.message));
                                    return;
                                }
                            } catch (e) {
                                // Ignore parse errors for incomplete JSON
                            }
                        }
                    }
                });

                res.on('end', () => {
                    if (assistantMessage && this.conversationHistory[this.conversationHistory.length - 1]?.role !== 'assistant') {
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: assistantMessage,
                        });
                        this._triggerMessage(assistantMessage, true);
                    }
                    resolve();
                });

                res.on('error', (error) => {
                    console.error('[OpenAIProvider] Response error:', error);
                    this._triggerError(error.message);
                    reject(error);
                });
            });

            req.on('error', (error) => {
                console.error('[OpenAIProvider] Request error:', error);
                this._triggerError(error.message);
                reject(error);
            });

            req.write(requestBody);
            req.end();
        });
    }

    async close() {
        try {
            this.isActive = false;
            this.conversationHistory = [];
            this.imageQueue = [];
            this._triggerClose();
            return { success: true };
        } catch (error) {
            console.error('[OpenAIProvider] Error closing session:', error);
            return { success: false, error: error.message };
        }
    }

    getCapabilities() {
        const modelInfo = this._getModelInfo(this.model);
        return {
            supportsText: true,
            supportsAudio: false,
            supportsImage: modelInfo.supportsVision,
            supportsStreaming: true,
            supportsTools: true, // OpenAI supports function calling but not implemented here yet
        };
    }

    _getModelInfo(modelId) {
        const visionModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision-preview'];
        return {
            supportsVision: visionModels.some(m => modelId.includes(m)),
        };
    }

    getAvailableModels() {
        return [
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                description: 'Multimodal flagship model with vision',
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                description: 'Affordable and intelligent small model',
            },
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Fast GPT-4 with vision support',
            },
            {
                id: 'gpt-4',
                name: 'GPT-4',
                description: 'Standard GPT-4 model (text only)',
            },
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                description: 'Fast and cost-effective (text only)',
            },
        ];
    }
}

module.exports = { OpenAIProvider };
