const { AIProvider } = require('./AIProvider');
const { getSystemPrompt } = require('../prompts');
const https = require('https');

/**
 * Anthropic Claude AI Provider
 * Supports Claude models via Anthropic API
 * Uses streaming for real-time responses
 */
class ClaudeProvider extends AIProvider {
    constructor() {
        super();
        this.providerName = 'claude';
        this.apiKey = null;
        this.model = null;
        this.conversationHistory = [];
        this.systemPrompt = '';
        this.isActive = false;

        // Image batching similar to OpenRouter
        this.imageQueue = [];
        this.lastImageSentTime = 0;
        this.imageSendInterval = 5000;
    }

    async initialize(apiKey, config) {
        try {
            this.apiKey = apiKey;
            this.model = config.model || 'claude-3-5-sonnet-20241022';
            this.isActive = true;

            this.systemPrompt = getSystemPrompt(
                config.profile || 'interview',
                config.customPrompt || '',
                config.googleSearchEnabled || false
            );

            // Claude uses system prompt separately, not in messages
            this.conversationHistory = [];

            console.log('[ClaudeProvider] Initialized with model:', this.model);
            this._triggerOpen();

            return { success: true };
        } catch (error) {
            console.error('[ClaudeProvider] Failed to initialize:', error);
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
            console.error('[ClaudeProvider] Error sending text:', error);
            return { success: false, error: error.message };
        }
    }

    async sendAudio(audioData, mimeType) {
        // Claude API doesn't support audio input directly
        return {
            success: false,
            error: 'Audio input not supported by Claude API. Please use text or image input.'
        };
    }

    async sendImage(imageData, mimeType) {
        if (!this.isActive) {
            return { success: false, error: 'No active session' };
        }

        try {
            // Add image to queue
            this.imageQueue.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: mimeType || 'image/jpeg',
                    data: imageData,
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
            console.error('[ClaudeProvider] Error queueing image:', error);
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
                    type: 'image',
                    source: latestImage.source,
                },
                {
                    type: 'text',
                    text: 'Analyze the current screen. What do you see that might be relevant to assist?',
                },
            ];

            this.conversationHistory.push({
                role: 'user',
                content: content,
            });

            await this._sendRequest();
        } catch (error) {
            console.error('[ClaudeProvider] Error sending queued images:', error);
        }
    }

    async _sendRequest() {
        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                system: this.systemPrompt,
                messages: this.conversationHistory,
                stream: true,
            });

            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
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

                            try {
                                const parsed = JSON.parse(data);

                                if (parsed.type === 'content_block_delta') {
                                    const delta = parsed.delta?.text;
                                    if (delta) {
                                        assistantMessage += delta;
                                        this._triggerMessage(assistantMessage, false);
                                    }
                                } else if (parsed.type === 'message_stop') {
                                    // Stream complete
                                    this.conversationHistory.push({
                                        role: 'assistant',
                                        content: assistantMessage,
                                    });
                                    this._triggerMessage(assistantMessage, true);
                                    resolve();
                                    return;
                                } else if (parsed.type === 'error') {
                                    this._triggerError(parsed.error?.message || 'Unknown error');
                                    reject(new Error(parsed.error?.message || 'Unknown error'));
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
                    console.error('[ClaudeProvider] Response error:', error);
                    this._triggerError(error.message);
                    reject(error);
                });
            });

            req.on('error', (error) => {
                console.error('[ClaudeProvider] Request error:', error);
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
            console.error('[ClaudeProvider] Error closing session:', error);
            return { success: false, error: error.message };
        }
    }

    getCapabilities() {
        return {
            supportsText: true,
            supportsAudio: false,
            supportsImage: true,
            supportsStreaming: true,
            supportsTools: true, // Claude supports tools but not implemented here yet
        };
    }

    getAvailableModels() {
        return [
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet (Latest)',
                description: 'Most intelligent model with vision',
            },
            {
                id: 'claude-3-5-sonnet-20240620',
                name: 'Claude 3.5 Sonnet (June)',
                description: 'Previous version of Claude 3.5 Sonnet',
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                description: 'Powerful model for complex tasks',
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                description: 'Balanced performance and speed',
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                description: 'Fast and efficient model',
            },
        ];
    }
}

module.exports = { ClaudeProvider };
