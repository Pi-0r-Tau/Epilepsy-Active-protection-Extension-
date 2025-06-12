'use strict';

(function() {
   
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
    /**
     * Validates the structure and type of a message object.
     * @param {Object} message - The message object to validate.
     * @returns {boolean} - Returns true if the message is valid.
     * @throws {Error} - Throws an error if the message is invalid.
     */
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
                    this.retrySaveSettings(settings);
                }
            }
        },

        /**
         * Recovers settings from chrome storage.
         * @returns {Promise<Object|null>} The recovered settings or null if recovery fails.
         */
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
        },

        retrySaveSettings(settings) {
            setTimeout(() => this.saveSettings(settings), 2000);
        }
    };

    // Secure message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handleAsyncResponse = async () => {
            try {
                if (!validateMessage(message)) {
                    throw new Error('Message validation failed');
                }

                const safeTabId = sender.tab?.id;

                switch (message.type) {
                    case 'statsRequest':
                        const result = await chrome.storage.sync.get(['stats', 'globalStats']);
                        sendResponse({
                            success: true,
                            stats: {
                                ...result.stats,
                                ...result.globalStats,
                                timestamp: Date.now()
                            }
                        });
                        break;

                    case 'settingsUpdate':
                        if (validateSettings(message.settings)) {
                            await settingsManager.saveSettings(message.settings);
                            await broadcastToAllTabs({
                                type: 'settingsUpdated',
                                settings: message.settings
                            });
                            sendResponse({ success: true });
                        } else {
                            sendResponse({ success: false, error: 'Invalid settings' });
                        }
                        break;

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
                console.error('Message handling error:', error);
                sendResponse({ success: false, error: error.message });
            }
        };

        handleAsyncResponse().catch(error => {
            console.error('Async handling error:', error);
            sendResponse({ success: false, error: 'Async operation failed' });
        });

        return true; // Indicate async response
    });

    /**
     * Validates the provided settings object.
     * @param {Object} settings - The settings object to validate.
     * @returns {boolean} - Returns true if the settings are valid, otherwise false.
     */
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
            const lastSensitivity = parseFloat(settings.userPreferences.lastSensitivity);
            if (isNaN(lastSensitivity) || lastSensitivity < 1 || lastSensitivity > 5) {
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

        /**
         * Updates the chrome storage with the provided data.
         * Retries the update operation if it fails, up to a maximum number of retries.
         * @param {Object} data - The data to be stored.
         * @param {number} [retryCount=0] - The current retry attempt count.
         * @returns {Promise<void>} A promise that resolves when the update is successful.
         */
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

        /**
         * Adds a data item to the storage queue and processes the queue.
         * @param {Object} data - The data to be stored.
         * @returns {Promise} - A promise that resolves when the data is successfully stored.
         */
        enqueue(data) {
            return new Promise((resolve, reject) => {
                this.queue.push({ data, resolve, reject });
                this.processQueue();
            });
        }
    };

    /**
     * Updates the global statistics and optionally broadcasts the update to all tabs.
     * @param {Object} stats - The statistics to update.
     * @param {boolean} [shouldBroadcast=false] - Whether to broadcast the update to all tabs.
     */
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
            .then(() => {
                lastStorageUpdate = now;
            })
            .catch(async error => {
                console.error('Stats update failed:', error);
                await settingsManager.recoverSettings();
            });

        if (shouldBroadcast) {
            broadcastToAllTabs({ type: 'statsUpdate', stats: state.globalStats });
        }
    }

    /**
     * Handles the connection of a tab by adding it to the active connections and protected tabs.
     * @param {number} tabId - The ID of the tab to handle.
     */
    function handleConnection(tabId) {
        if (tabId) {
            state.connections.set(tabId, true);
            state.activeTabsProtected.add(tabId);
        }
    }

    /**
     * Broadcasts a message to all active tabs.
     * This function iterates over all active connections and sends the provided message to each tab.
     * If a tab fails to receive the message, it is removed from the active connections and protected tabs.
     * @param {Object} message - The message to broadcast.
     */
    async function broadcastToAllTabs(message) {
        const activeConnections = new Map(state.connections);
        for (const [tabId] of activeConnections) {
            try {
                // Check if tab exists before sending
                const tab = await chrome.tabs.get(tabId).catch(() => null);
                if (tab && tab.status === 'complete') {
                    await chrome.tabs.sendMessage(tabId, message).catch(error => {
                        // Only log non-connection errors
                        if (!error.message.includes('Receiving end does not exist')) {
                            console.error(`Failed to send message to tab ${tabId}:`, error);
                        }
                        state.connections.delete(tabId);
                        state.activeTabsProtected.delete(tabId);
                    });
                } else {
                    state.connections.delete(tabId);
                    state.activeTabsProtected.delete(tabId);
                }
            } catch (error) {
                // Handle any other errors
                console.error(`Error processing tab ${tabId}:`, error);
                state.connections.delete(tabId);
                state.activeTabsProtected.delete(tabId);
            }
        }
    }

    // Initialize state from storage
    chrome.storage.sync.get(['globalStats'], (result) => {
        if (result.globalStats) {
            state.globalStats = result.globalStats;
        }
    });
})();