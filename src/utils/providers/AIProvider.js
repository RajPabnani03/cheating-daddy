/**
 * Base AIProvider class
 * All AI providers must extend this class and implement the required methods
 */
class AIProvider {
    constructor() {
        this.session = null;
        this.providerName = 'base';
        this.callbacks = {};
    }

    /**
     * Initialize the AI session with API key and configuration
     * @param {string} apiKey - API key for the provider
     * @param {object} config - Configuration object
     * @param {string} config.profile - Profile name (interview, sales, etc.)
     * @param {string} config.customPrompt - Custom user prompt
     * @param {string} config.language - Language code (e.g., 'en-US')
     * @param {boolean} config.googleSearchEnabled - Enable Google Search tool
     * @param {string} config.model - Model name/ID
     * @param {object} config.callbacks - Callback functions
     * @param {function} config.callbacks.onOpen - Called when session opens
     * @param {function} config.callbacks.onMessage - Called when message received
     * @param {function} config.callbacks.onError - Called on error
     * @param {function} config.callbacks.onClose - Called when session closes
     * @returns {Promise<boolean>} Success status
     */
    async initialize(apiKey, config) {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Send text message to the AI
     * @param {string} text - Text message to send
     * @returns {Promise<object>} Result object with success status
     */
    async sendText(text) {
        throw new Error('sendText() must be implemented by provider');
    }

    /**
     * Send audio data to the AI
     * @param {string} audioData - Base64 encoded audio data
     * @param {string} mimeType - MIME type of audio (e.g., 'audio/pcm;rate=24000')
     * @returns {Promise<object>} Result object with success status
     */
    async sendAudio(audioData, mimeType) {
        throw new Error('sendAudio() must be implemented by provider');
    }

    /**
     * Send image data to the AI
     * @param {string} imageData - Base64 encoded image data
     * @param {string} mimeType - MIME type of image (e.g., 'image/jpeg')
     * @returns {Promise<object>} Result object with success status
     */
    async sendImage(imageData, mimeType) {
        throw new Error('sendImage() must be implemented by provider');
    }

    /**
     * Close the AI session
     * @returns {Promise<object>} Result object with success status
     */
    async close() {
        throw new Error('close() must be implemented by provider');
    }

    /**
     * Get provider capabilities
     * @returns {object} Capabilities object
     */
    getCapabilities() {
        return {
            supportsText: false,
            supportsAudio: false,
            supportsImage: false,
            supportsStreaming: false,
            supportsTools: false,
        };
    }

    /**
     * Get available models for this provider
     * @returns {Array<object>} Array of model objects with id and name
     */
    getAvailableModels() {
        return [];
    }

    /**
     * Set callbacks for session events
     * @param {object} callbacks - Callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = callbacks || {};
    }

    /**
     * Helper to trigger onMessage callback
     * @param {string} message - Message text
     * @param {boolean} isComplete - Whether the message is complete
     */
    _triggerMessage(message, isComplete = false) {
        if (this.callbacks.onMessage) {
            this.callbacks.onMessage(message, isComplete);
        }
    }

    /**
     * Helper to trigger onError callback
     * @param {Error|string} error - Error object or message
     */
    _triggerError(error) {
        if (this.callbacks.onError) {
            const errorMessage = error instanceof Error ? error.message : error;
            this.callbacks.onError(errorMessage);
        }
    }

    /**
     * Helper to trigger onOpen callback
     */
    _triggerOpen() {
        if (this.callbacks.onOpen) {
            this.callbacks.onOpen();
        }
    }

    /**
     * Helper to trigger onClose callback
     * @param {string} reason - Close reason
     */
    _triggerClose(reason = '') {
        if (this.callbacks.onClose) {
            this.callbacks.onClose(reason);
        }
    }
}

module.exports = { AIProvider };
