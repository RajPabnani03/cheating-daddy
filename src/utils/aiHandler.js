const { BrowserWindow, ipcMain } = require('electron');
const { ProviderFactory } = require('./providers/ProviderFactory');
const { spawn } = require('child_process');

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let isInitializingSession = false;

// Audio capture variables
let systemAudioProc = null;

// Current provider instance
let currentProvider = null;
let currentProviderName = null;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Conversation management functions
function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    console.log('[AIHandler] New conversation session started:', currentSessionId);
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('[AIHandler] Saved conversation turn');

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
        provider: currentProviderName,
    };
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));

            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        return stored || '${defaultValue}';
                    } catch (e) {
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('[AIHandler] Error getting stored setting for', key, ':', error.message);
    }
    return defaultValue;
}

async function initializeAISession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', providerName = 'gemini', model = null) {
    if (isInitializingSession) {
        console.log('[AIHandler] Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    try {
        // Get Google Search setting
        const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'false');

        // Create provider instance
        console.log(`[AIHandler] Creating ${providerName} provider...`);
        currentProvider = ProviderFactory.createProvider(providerName);
        currentProviderName = providerName;

        // Set up callbacks
        currentProvider.setCallbacks({
            onOpen: () => {
                console.log('[AIHandler] Provider session opened');
                sendToRenderer('update-status', 'Live session connected');
            },
            onMessage: (message, isComplete) => {
                sendToRenderer('update-response', message);
                if (isComplete) {
                    // Save conversation turn if we have transcription
                    if (currentTranscription && message) {
                        saveConversationTurn(currentTranscription, message);
                        currentTranscription = '';
                    }
                    sendToRenderer('update-status', 'Listening...');
                }
            },
            onError: (error) => {
                console.error('[AIHandler] Provider error:', error);
                sendToRenderer('update-status', 'Error: ' + error);
            },
            onClose: (reason) => {
                console.log('[AIHandler] Provider session closed:', reason);
                sendToRenderer('update-status', reason ? 'Session closed: ' + reason : 'Session closed');
            },
        });

        // Initialize new conversation session
        initializeNewSession();

        // Initialize provider
        const result = await currentProvider.initialize(apiKey, {
            profile,
            customPrompt,
            language,
            googleSearchEnabled: googleSearchEnabled === 'true',
            model: model || getDefaultModel(providerName),
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to initialize provider');
        }

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return true;
    } catch (error) {
        console.error('[AIHandler] Failed to initialize AI session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        sendToRenderer('update-status', 'Error: ' + error.message);
        return false;
    }
}

function getDefaultModel(providerName) {
    switch (providerName) {
        case 'gemini':
            return 'gemini-live-2.5-flash-preview';
        case 'openrouter':
            return 'anthropic/claude-3.5-sonnet';
        case 'claude':
            return 'claude-3-5-sonnet-20241022';
        case 'openai':
            return 'gpt-4o';
        default:
            return null;
    }
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

async function sendAudioToProvider(base64Data, providerRef) {
    if (!currentProvider) return;

    try {
        process.stdout.write('.');
        await currentProvider.sendAudio(base64Data, 'audio/pcm;rate=24000');
    } catch (error) {
        console.error('[AIHandler] Error sending audio to provider:', error);
    }
}

async function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('[AIHandler] Checking for existing SystemAudioDump processes...');

        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('[AIHandler] Killed existing SystemAudioDump processes');
            }
            resolve();
        });

        killProc.on('error', () => resolve());

        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(providerRef) {
    if (process.platform !== 'darwin') return false;

    await killExistingSystemAudioDump();

    console.log('[AIHandler] Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            PROCESS_NAME: 'AudioService',
            APP_NAME: 'System Audio Service',
        },
    };

    if (process.platform === 'darwin') {
        spawnOptions.detached = false;
        spawnOptions.windowsHide = false;
    }

    systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

    if (!systemAudioProc.pid) {
        console.error('[AIHandler] Failed to start SystemAudioDump');
        return false;
    }

    console.log('[AIHandler] SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = monoChunk.toString('base64');
            sendAudioToProvider(base64Data, providerRef);
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('[AIHandler] SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('[AIHandler] SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('[AIHandler] SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('[AIHandler] Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

function setupAIIpcHandlers(sessionRef) {
    // Initialize session with selected provider
    ipcMain.handle('initialize-ai', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US', providerName = 'gemini', model = null) => {
        const success = await initializeAISession(apiKey, customPrompt, profile, language, providerName, model);
        if (success && sessionRef) {
            sessionRef.current = { provider: currentProvider, providerName: currentProviderName };
        }
        return success;
    });

    // Backward compatibility: initialize-gemini calls initialize-ai with gemini provider
    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        return await initializeAISession(apiKey, customPrompt, profile, language, 'gemini');
    });

    // Get available providers
    ipcMain.handle('get-available-providers', async () => {
        try {
            return { success: true, providers: ProviderFactory.getAvailableProviders() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get available models for a provider
    ipcMain.handle('get-available-models', async (event, providerName) => {
        try {
            const provider = ProviderFactory.createProvider(providerName);
            const models = provider.getAvailableModels();
            return { success: true, models };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!currentProvider) return { success: false, error: 'No active session' };
        try {
            return await currentProvider.sendAudio(data, mimeType);
        } catch (error) {
            console.error('[AIHandler] Error sending audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        if (!currentProvider) return { success: false, error: 'No active session' };

        try {
            if (!data || typeof data !== 'string') {
                console.error('[AIHandler] Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`[AIHandler] Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            process.stdout.write('!');
            return await currentProvider.sendImage(data, 'image/jpeg');
        } catch (error) {
            console.error('[AIHandler] Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!currentProvider) return { success: false, error: 'No active session' };

        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log('[AIHandler] Sending text message:', text);
            return await currentProvider.sendText(text.trim());
        } catch (error) {
            console.error('[AIHandler] Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(sessionRef);
            return { success };
        } catch (error) {
            console.error('[AIHandler] Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('[AIHandler] Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            if (currentProvider) {
                await currentProvider.close();
                currentProvider = null;
                currentProviderName = null;
            }

            return { success: true };
        } catch (error) {
            console.error('[AIHandler] Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('[AIHandler] Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('[AIHandler] Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('[AIHandler] Google Search setting updated to:', enabled);
            return { success: true };
        } catch (error) {
            console.error('[AIHandler] Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    setupAIIpcHandlers,
    initializeAISession,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    stopMacOSAudioCapture,
    sendToRenderer,
};
