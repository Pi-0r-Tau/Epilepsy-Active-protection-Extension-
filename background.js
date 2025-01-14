'use strict';

(function() {
    // Private state
    const state = Object.seal({
        activeTabsProtected: new Set(),
        globalStats: {
            totalFlashes: 0,
            lastDetection: null
        },
        connections: new Map()
    });

    let lastStorageUpdate = 0;
    const MIN_STORAGE_INTERVAL = 2000; // Minimum 2 seconds between storage operations

    // Validate message data
    function validateMessage(message) {
        if (!message || typeof message !== 'object') {
            throw new Error('Invalid message format');
        }
        if (typeof message.type !== 'string') {
            throw new Error('Invalid message type');
        }
        return true;
    }

    // Add settings recovery mechanism
    const settingsManager = {
        lastSettings: null,
        retryAttempts: 0,
        maxRetries: 3,

        async saveSettings(settings) {
            this.lastSettings = settings;
            try {
                await storageManager.enqueue(settings);
                this.retryAttempts = 0;
            } catch (error) {
                console.error('Settings save failed:', error);
                if (this.retryAttempts < this.maxRetries) {
                    this.retryAttempts++;
                    setTimeout(() => this.saveSettings(settings), 2000);
                }
            }
        },

        async recoverSettings() {
            try {
                const result = await chrome.storage.sync.get(['stats', 'threshold', 'userPreferences']);
                if (result.stats) {
                    state.globalStats = result.stats;
                }
                if (result.threshold) {
                    broadcastToAllTabs({
                        type: 'settingsUpdated',
                        settings: {
                            threshold: result.threshold,
                            userPreferences: result.userPreferences
                        }
                    });
                }
                return result;
            } catch (error) {
                console.error('Settings recovery failed:', error);
                return null;
            }
        }
    };

    // Secure message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (!validateMessage(message)) {
                throw new Error('Message validation failed');
            }

            const safeTabId = sender.tab?.id;

            switch (message.type) {
                case 'statsRequest':
                    // Fetch latest stats and send them back
                    chrome.storage.sync.get(['stats', 'globalStats'], result => {
                        const stats = {
                            ...result.stats,
                            ...result.globalStats,
                            timestamp: Date.now()
                        };
                        sendResponse({ success: true, stats });
                    });
                    return true; // Keep channel open

                case 'settingsUpdate':
                    // Validate settings before saving
                    if (validateSettings(message.settings)) {
                        settingsManager.saveSettings(message.settings)
                            .then(() => {
                                broadcastToAllTabs({
                                    type: 'settingsUpdated',
                                    settings: message.settings
                                });
                                sendResponse({ success: true });
                            })
                            .catch(error => {
                                console.error('Settings save failed:', error);
                                sendResponse({ success: false, error: 'Settings save failed' });
                            });
                    } else {
                        sendResponse({ success: false, error: 'Invalid settings' });
                    }
                    return true;

                case 'statsUpdate':
                    updateGlobalStats(message.stats, true);
                    sendResponse({ success: true });
                    break;
                case 'getState':
                    sendResponse(state);
                    break;
                case 'sensitivityChanged':
                    broadcastToAllTabs(message);
                    sendResponse({ success: true });
                    break;
                case 'connect':
                    handleConnection(safeTabId);
                    sendResponse({ success: true });
                    break;
                case 'recoveryRequest':
                    settingsManager.recoverSettings()
                        .then(settings => sendResponse({ success: true, settings }))
                        .catch(error => sendResponse({ success: false, error }));
                    return true; // Keep channel open for async response
            }
        } catch (error) {
            console.error('[Security] Message handling error:', error);
            sendResponse({ success: false, error: 'Security validation failed' });
        }
        return true; // Keep connection alive for async response
    });

    function validateSettings(settings) {
        if (!settings) return false;

        // Validate threshold
        if ('threshold' in settings) {
            const threshold = parseFloat(settings.threshold);
            if (isNaN(threshold) || threshold < 0.1 || threshold > 0.5) {
                return false;
            }
        }

        // Validate userPreferences
        if (settings.userPreferences) {
            const { lastSensitivity } = settings.userPreferences;
            if (lastSensitivity && (lastSensitivity < 1 || lastSensitivity > 5)) {
                return false;
            }
        }

        return true;
    }

    // Track protected tabs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            state.activeTabsProtected.add(tabId);
        }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        state.activeTabsProtected.delete(tabId);
    });

    // Storage management with retry logic
    const storageManager = {
        queue: [],
        isProcessing: false,
        retryDelay: 2000,
        maxRetries: 3,

        async update(data, retryCount = 0) {
            return new Promise((resolve, reject) => {
                try {
                    chrome.storage.sync.set(data, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Storage update retry:', chrome.runtime.lastError);
                            if (retryCount < this.maxRetries) {
                                setTimeout(() => {
                                    this.update(data, retryCount + 1)
                                        .then(resolve)
                                        .catch(reject);
                                }, this.retryDelay);
                            } else {
                                reject(chrome.runtime.lastError);
                            }
                        } else {
                            resolve();
                        }
                    });
                } catch (error) {
                    reject(error);
                }
            });
        },

        async processQueue() {
            if (this.isProcessing || this.queue.length === 0) return;

            this.isProcessing = true;
            const item = this.queue.shift();

            try {
                await this.update(item.data);
                item.resolve();
            } catch (error) {
                item.reject(error);
            } finally {
                this.isProcessing = false;
                if (this.queue.length > 0) {
                    setTimeout(() => this.processQueue(), 1000);
                }
            }
        },

        enqueue(data) {
            return new Promise((resolve, reject) => {
                this.queue.push({ data, resolve, reject });
                this.processQueue();
            });
        }
    };

    function updateGlobalStats(stats, shouldBroadcast = false) {
        if (!stats) return;

        const now = Date.now();
        if (now - lastStorageUpdate < MIN_STORAGE_INTERVAL) {
            return;
        }

        state.globalStats = {
            ...state.globalStats,
            ...stats,
            lastUpdate: now
        };

        storageManager.enqueue({ globalStats: state.globalStats })
            .catch(async error => {
                console.error('Stats update failed:', error);
                await settingsManager.recoverSettings();
            });

        if (shouldBroadcast) {
            broadcastToAllTabs({ type: 'statsUpdate', stats: state.globalStats });
        }
    }

    function handleConnection(tabId) {
        if (tabId) {
            state.connections.set(tabId, true);
            state.activeTabsProtected.add(tabId);
        }
    }

    function broadcastToAllTabs(message) {
        const activeConnections = new Map(state.connections);
        activeConnections.forEach((value, tabId) => {
            chrome.tabs.sendMessage(tabId, message).catch(() => {
                state.connections.delete(tabId);
                state.activeTabsProtected.delete(tabId);
            });
        });
    }

    // Initialize state from storage
    chrome.storage.sync.get(['globalStats'], (result) => {
        if (result.globalStats) {
            state.globalStats = result.globalStats;
        }
    });
})();
