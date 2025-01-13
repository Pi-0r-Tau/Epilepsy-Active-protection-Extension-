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

    // Secure message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (!validateMessage(message)) {
                throw new Error('Message validation failed');
            }

            const safeTabId = sender.tab?.id;
            if (!safeTabId) {
                throw new Error('Invalid sender');
            }

            switch (message.type) {
                case 'statsUpdate':
                    updateGlobalStats(message.stats);
                    broadcastToAllTabs(message);
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
                case 'settingsUpdate':
                    broadcastToAllTabs(message);
                    sendResponse({ success: true });
                    break;
            }
        } catch (error) {
            console.error('[Security] Message handling error:', error);
            sendResponse({ success: false, error: 'Security validation failed' });
        }
        return true; // Keep connection alive for async response
    });

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

    function updateGlobalStats(stats) {
        const now = Date.now();
        if (now - lastStorageUpdate < MIN_STORAGE_INTERVAL) {
            return; // Skip update if too soon
        }

        state.globalStats.totalFlashes += stats.flashCount;
        state.globalStats.lastDetection = stats.lastDetection;

        // Queue storage update
        storageManager.enqueue({ globalStats: state.globalStats })
            .catch(error => console.error('Failed to update stats:', error));
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
