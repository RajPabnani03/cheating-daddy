const { AIProvider } = require('./AIProvider');
const { getSystemPrompt } = require('../prompts');
const https = require('https');

/**
 * OpenRouter AI Provider
 * Supports multiple models (Claude, GPT-4, Llama, etc.) via OpenRouter API
 * Uses REST API with Server-Sent Events for streaming
 */
class OpenRouterProvider extends AIProvider {
    constructor() {
        super();
        this.providerName = 'openrouter';
        this.apiKey = null;
        this.model = null;
        this.conversationHistory = [];
        this.systemPrompt = '';
        this.isActive = false;

        // Accumulate images and send periodically
        this.imageQueue = [];
        this.lastImageSentTime = 0;
        this.imageSendInterval = 5000; // Send images every 5 seconds
    }

    async initialize(apiKey, config) {
        try {
            this.apiKey = apiKey;
            this.model = config.model || 'anthropic/claude-3.5-sonnet';
            this.isActive = true;

            this.systemPrompt = getSystemPrompt(
                config.profile || 'interview',
                config.customPrompt || '',
                config.googleSearchEnabled || false
            );

            // Initialize conversation with system prompt
            this.conversationHistory = [
                {
                    role: 'system',
                    content: this.systemPrompt,
                },
            ];

            console.log('[OpenRouterProvider] Initialized with model:', this.model);
            this._triggerOpen();

            return { success: true };
        } catch (error) {
            console.error('[OpenRouterProvider] Failed to initialize:', error);
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
            console.error('[OpenRouterProvider] Error sending text:', error);
            return { success: false, error: error.message };
        }
    }

    async sendAudio(audioData, mimeType) {
        // OpenRouter doesn't support real-time audio streaming
        // Audio would need to be transcribed first (using Whisper or similar)
        // For now, we'll return an error
        return {
            success: false,
            error: 'Audio input not supported by OpenRouter. Please use text or image input.'
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
                    error: `Model ${this.model} does not support image input. Please select a vision-capable model.`
                };
            }

            // Add image to queue
            this.imageQueue.push({
                type: 'image',
                data: imageData,
                mimeType: mimeType || 'image/jpeg',
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
            console.error('[OpenRouterProvider] Error queueing image:', error);
            return { success: false, error: error.message };
        }
    }

    async _sendQueuedImages() {
        if (this.imageQueue.length === 0) return;

        try {
            // Take the most recent image (we don't need all of them)
            const latestImage = this.imageQueue[this.imageQueue.length - 1];
            this.imageQueue = [];

            // Build multimodal message with image
            const content = [
                {
                    type: 'text',
                    text: 'Analyze the current screen. What do you see that might be relevant?',
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${latestImage.mimeType};base64,${latestImage.data}`,
                    },
                },
            ];

            this.conversationHistory.push({
                role: 'user',
                content: content,
            });

            await this._sendRequest();
        } catch (error) {
            console.error('[OpenRouterProvider] Error sending queued images:', error);
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
                hostname: 'openrouter.ai',
                port: 443,
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'HTTP-Referer': 'https://github.com/cheating-daddy',
                    'X-Title': 'Cheating Daddy',
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
                            } catch (e) {
                                // Ignore parse errors for incomplete JSON
                            }
                        }
                    }
                });

                res.on('end', () => {
                    if (assistantMessage) {
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: assistantMessage,
                        });
                        this._triggerMessage(assistantMessage, true);
                    }
                    resolve();
                });
            });

            req.on('error', (error) => {
                console.error('[OpenRouterProvider] Request error:', error);
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
            console.error('[OpenRouterProvider] Error closing session:', error);
            return { success: false, error: error.message };
        }
    }

    getCapabilities() {
        const modelInfo = this._getModelInfo(this.model);
        return {
            supportsText: true,
            supportsAudio: false, // Would require transcription service
            supportsImage: modelInfo.supportsVision,
            supportsStreaming: true,
            supportsTools: false,
        };
    }

    _getModelInfo(modelId) {
        const visionModels = [
            'anthropic/claude-3.5-sonnet',
            'anthropic/claude-3-opus',
            'anthropic/claude-3-sonnet',
            'anthropic/claude-3-haiku',
            'openai/gpt-4-turbo',
            'openai/gpt-4o',
            'openai/gpt-4-vision-preview',
            'google/gemini-pro-vision',
        ];

        return {
            supportsVision: visionModels.some(m => modelId.includes(m.split('/')[1])),
        };
    }

    getAvailableModels() {
        return [
            // Anthropic Claude models
            {
                id: 'anthropic/claude-3.5-sonnet',
                name: 'Claude 3.5 Sonnet',
                description: 'Most intelligent model, supports vision',
                provider: 'Anthropic',
                supportsVision: true,
            },
            {
                id: 'anthropic/claude-3-opus',
                name: 'Claude 3 Opus',
                description: 'Powerful model for complex tasks, supports vision',
                provider: 'Anthropic',
                supportsVision: true,
            },
            {
                id: 'anthropic/claude-3-sonnet',
                name: 'Claude 3 Sonnet',
                description: 'Balanced performance and speed, supports vision',
                provider: 'Anthropic',
                supportsVision: true,
            },
            {
                id: 'anthropic/claude-3-haiku',
                name: 'Claude 3 Haiku',
                description: 'Fast and efficient, supports vision',
                provider: 'Anthropic',
                supportsVision: true,
            },

            // OpenAI models
            {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                description: 'Multimodal flagship model',
                provider: 'OpenAI',
                supportsVision: true,
            },
            {
                id: 'openai/gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Fast GPT-4 with vision support',
                provider: 'OpenAI',
                supportsVision: true,
            },
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
                description: 'Standard GPT-4 model',
                provider: 'OpenAI',
                supportsVision: false,
            },
            {
                id: 'openai/gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                description: 'Fast and cost-effective',
                provider: 'OpenAI',
                supportsVision: false,
            },

            // Google models
            {
                id: 'google/gemini-pro',
                name: 'Gemini Pro',
                description: 'Google\'s powerful text model',
                provider: 'Google',
                supportsVision: false,
            },
            {
                id: 'google/gemini-pro-vision',
                name: 'Gemini Pro Vision',
                description: 'Gemini with vision capabilities',
                provider: 'Google',
                supportsVision: true,
            },

            // Meta models
            {
                id: 'meta-llama/llama-3.1-405b-instruct',
                name: 'Llama 3.1 405B',
                description: 'Largest Llama model',
                provider: 'Meta',
                supportsVision: false,
            },
            {
                id: 'meta-llama/llama-3.1-70b-instruct',
                name: 'Llama 3.1 70B',
                description: 'High-performance open model',
                provider: 'Meta',
                supportsVision: false,
            },

            // Mistral models
            {
                id: 'mistralai/mistral-large',
                name: 'Mistral Large',
                description: 'Flagship Mistral model',
                provider: 'Mistral',
                supportsVision: false,
            },
            {
                id: 'mistralai/mistral-medium',
                name: 'Mistral Medium',
                description: 'Balanced Mistral model',
                provider: 'Mistral',
                supportsVision: false,
            },
        ];
    }
}

module.exports = { OpenRouterProvider };
