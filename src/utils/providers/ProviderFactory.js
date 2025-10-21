const { GeminiProvider } = require('./GeminiProvider');
const { OpenRouterProvider } = require('./OpenRouterProvider');
const { ClaudeProvider } = require('./ClaudeProvider');
const { OpenAIProvider } = require('./OpenAIProvider');

/**
 * Factory class for creating AI provider instances
 */
class ProviderFactory {
    /**
     * Create a provider instance based on provider name
     * @param {string} providerName - Name of the provider ('gemini', 'openrouter', 'claude', 'openai')
     * @returns {AIProvider} Provider instance
     * @throws {Error} If provider name is unknown
     */
    static createProvider(providerName) {
        const normalizedName = providerName.toLowerCase().trim();

        switch (normalizedName) {
            case 'gemini':
                return new GeminiProvider();

            case 'openrouter':
                return new OpenRouterProvider();

            case 'claude':
            case 'anthropic':
                return new ClaudeProvider();

            case 'openai':
            case 'gpt':
                return new OpenAIProvider();

            default:
                throw new Error(`Unknown provider: ${providerName}. Supported providers: gemini, openrouter, claude, openai`);
        }
    }

    /**
     * Get list of all available providers with metadata
     * @returns {Array<object>} Array of provider info objects
     */
    static getAvailableProviders() {
        return [
            {
                id: 'gemini',
                name: 'Google Gemini',
                description: 'Real-time multimodal AI with streaming',
                capabilities: {
                    text: true,
                    audio: true,
                    image: true,
                    streaming: true,
                    tools: true,
                },
                requiresApiKey: true,
                apiKeyUrl: 'https://aistudio.google.com/apikey',
            },
            {
                id: 'openrouter',
                name: 'OpenRouter',
                description: 'Access to multiple AI models (Claude, GPT, Llama, etc.)',
                capabilities: {
                    text: true,
                    audio: false,
                    image: true, // Model-dependent
                    streaming: true,
                    tools: false,
                },
                requiresApiKey: true,
                apiKeyUrl: 'https://openrouter.ai/keys',
            },
            {
                id: 'claude',
                name: 'Anthropic Claude',
                description: 'Claude 3.5 Sonnet and other Claude models',
                capabilities: {
                    text: true,
                    audio: false,
                    image: true,
                    streaming: true,
                    tools: true,
                },
                requiresApiKey: true,
                apiKeyUrl: 'https://console.anthropic.com/settings/keys',
            },
            {
                id: 'openai',
                name: 'OpenAI',
                description: 'GPT-4o, GPT-4 Turbo, and other GPT models',
                capabilities: {
                    text: true,
                    audio: false,
                    image: true, // Model-dependent
                    streaming: true,
                    tools: true,
                },
                requiresApiKey: true,
                apiKeyUrl: 'https://platform.openai.com/api-keys',
            },
        ];
    }

    /**
     * Get provider info by ID
     * @param {string} providerId - Provider ID
     * @returns {object|null} Provider info or null if not found
     */
    static getProviderInfo(providerId) {
        const providers = this.getAvailableProviders();
        return providers.find(p => p.id === providerId) || null;
    }

    /**
     * Validate that a provider exists
     * @param {string} providerName - Provider name to validate
     * @returns {boolean} True if provider exists
     */
    static isValidProvider(providerName) {
        const validProviders = ['gemini', 'openrouter', 'claude', 'anthropic', 'openai', 'gpt'];
        return validProviders.includes(providerName.toLowerCase().trim());
    }
}

module.exports = { ProviderFactory };
