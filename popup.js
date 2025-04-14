'use strict';
// Sanitize DOM queries and manage user preferences 
(function() {
    /**
     * Safely retrieves an element by its ID
     * If the element is not found, a warning is logged
     * and a dummy div element is returned
     * @param {string} id - The ID of the element to retrieve 
     * @returns {HTMLElement} The retrieved element or a dummy div element
     */
    function safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element not found: ${id}`);
            return document.createElement('div'); // Fallback to a dummy element
        }
        return element;
    }

    document.addEventListener('DOMContentLoaded', () => {
        try {
            /**
             * @typedef {object} threshold - The threshold control element
             * @property {HTMLElement} highContrast - The high contrast control element
             * @property {HTMLElement} sensitivityDisplay - The sensitivity display element
             * @property {HTMLElement} stats - The status display element
             * @property {HTMLElement} flashCount - The flash count display element
             * @property {HTMLElement} lastDetection - The last detection display element
             * 
             */
            /**
             * * Controls object containing references to various DOM elements
             * @type {controls}
             */
            const controls = Object.freeze({
                threshold: safeGetElement('threshold'),
                highContrast: safeGetElement('high-contrast'),
                sensitivityDisplay: safeGetElement('sensitivityDisplay'),
                status: safeGetElement('status'),
                flashCount: safeGetElement('flashCount'),
                lastDetection: safeGetElement('lastDetection')
            });

            /**
             * User preferences object
             * @type {object}
             * @property {boolean} highContrast - Indicates if hight contrast mode is enabled
             * @property {Number} - lastSensitivity - The last Sensitivity setting
             */

            let userPreferences = {
                highContrast: false,
                lastSensitivity: 3
            };

            /**
             * Sensitivity labels mapping
             * @type {Object.<number, string>}
             */

            // Add sensitivity labels
            const SENSITIVITY_LABELS = {
                1: 'Very Low',
                2: 'Low',
                3: 'Medium',
                4: 'High',
                5: 'Very High'
            };

            function getSensitivityLabel(value) {
                return SENSITIVITY_LABELS[value] || SENSITIVITY_LABELS[userPreferences.lastSensitivity];
            }

            function initializeSettings() {
                chrome.runtime.sendMessage({ type: 'recoveryRequest' }, response => {
                    if (response?.success && response.settings) {
                        updateControls(response.settings);
                        updateStats(response.settings.stats);
                    } else {
                        // Fallback to default settings
                        chrome.storage.sync.get({
                            threshold: 0.25,
                            stats: { flashCount: 0, lastDetection: null },
                            userPreferences: {
                                lastSensitivity: 3,
                                highContrast: false
                            }
                        }, settings => {
                            updateControls(settings);
                            updateStats(settings.stats);
                        });
                    }
                });
            }

            // Initialize settings with fixed protection level
            chrome.storage.sync.get({
                threshold: 0.25,
                highContrast: false,
                stats: { flashCount: 0, lastDetection: null },
                userPreferences: {
                    lastSensitivity: 3,
                    highContrast: false
                }
            }, (settings) => {
                userPreferences = settings.userPreferences;
                updateControls(settings);
                updateStats(settings.stats);
            });

            // Live settings update
            Object.keys(controls).forEach(key => {
                const control = controls[key];
                if (control && control.type === 'range') {
                    control.addEventListener('input', updateSetting);
                }
            });

            // Apply high contrast mode with persistence
            controls.highContrast.addEventListener('change', (e) => {
                const isHighContrast = e.target.checked;
                document.body.classList.toggle('high-contrast', isHighContrast);

                userPreferences.highContrast = isHighContrast;

                // Save to storage
                chrome.storage.sync.set({ userPreferences });

                // Notify content script
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'themeChange',
                        highContrast: isHighContrast
                    });
                });
            });

            /**
             * Timeout for settings update debounce TODO: Review if needed
             * @type {number|null}
             */

            let settingsUpdateTimeout = null;

            /**
             * Debounce delay for settings updates in miliseconds TODO: Fix unused value
             * @type {number}
             */
            const DEBOUNCE_DELAY = 50; // 50ms debounce for settings updates

            // Global debounce for all storage operations
            let storageDebounceTimer = null;
            const STORAGE_DEBOUNCE_DELAY = 2000; // 2 seconds between storage operations
            let pendingStorageUpdates = {};

            function batchStorageUpdate() {
                if (Object.keys(pendingStorageUpdates).length === 0) return;

                if (storageDebounceTimer) {
                    clearTimeout(storageDebounceTimer);
                }

                storageDebounceTimer = setTimeout(() => {
                    chrome.storage.sync.set(pendingStorageUpdates, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Storage update failed:', chrome.runtime.lastError);
                            // Retry once after delay
                            setTimeout(() => {
                                chrome.storage.sync.set(pendingStorageUpdates);
                            }, 2000);
                        }
                        pendingStorageUpdates = {};
                    });
                }, STORAGE_DEBOUNCE_DELAY);
            }

            // Storage update queue
            const storageQueue = {
                pending: new Map(),
                processing: false,

                async update(key, value) {
                    return new Promise((resolve, reject) => {
                        this.pending.set(key, { value, resolve, reject });
                        this.process();
                    });
                },

                async process() {
                    if (this.processing || this.pending.size === 0) return;
                    this.processing = true;

                    const CHUNK_SIZE = 10; // Process in chunks of 10 items
                    const entries = Array.from(this.pending.entries());
                    this.pending.clear();

                    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
                        const chunk = entries.slice(i, i + CHUNK_SIZE);
                        const batch = {};
                        const callbacks = new Map();

                        chunk.forEach(([key, item]) => {
                            batch[key] = item.value;
                            callbacks.set(key, { resolve: item.resolve, reject: item.reject });
                        });

                        try {
                            await new Promise((resolve, reject) => {
                                chrome.storage.sync.set(batch, () => {
                                    if (chrome.runtime.lastError) {
                                        reject(chrome.runtime.lastError);
                                    } else {
                                        resolve();
                                    }
                                });
                            });

                            callbacks.forEach(({ resolve }) => resolve());
                        } catch (error) {
                            console.error('Storage update failed:', error);
                            callbacks.forEach(({ reject }) => reject(error));
                        }
                    }

                    this.processing = false;
                    if (this.pending.size > 0) {
                        setTimeout(() => this.process(), 1000);
                    }
                }
            };

            function updateSetting(e) {
                try {
                    if (e.target.type === 'range') {
                        const value = parseFloat(e.target.value);
                        const threshold = 0.5 - (value * 0.08);

                        // Update display immediately
                        controls.sensitivityDisplay.textContent = getSensitivityLabel(value);
                        announceChange(`Sensitivity set to ${controls.sensitivityDisplay.textContent}`);

                        const settings = {
                            threshold: threshold,
                            userPreferences: {
                                lastSensitivity: value,
                                highContrast: controls.highContrast.checked
                            }
                        };

                        // Add to batch for immediate operations
                        Object.entries(settings).forEach(([key, value]) => {
                            pendingStorageUpdates[key] = value;
                        });
                        batchStorageUpdate();

                        // Queue in storageQueue for reliability
                        storageQueue.update('settings', settings)
                            .then(() => {
                                // After successful storage update, notify background
                                chrome.runtime.sendMessage({
                                    type: 'settingsUpdate',
                                    settings: settings
                                });
                                notifyTabs(settings);
                            })
                            .catch(error => {
                                console.error('Settings update failed:', error);
                                controls.status.textContent = 'Settings update failed. Please try again.';
                                // Force stats refresh to resync
                                chrome.runtime.sendMessage({ type: 'statsRequest' });
                            });
                    }
                } catch (error) {
                    console.error('Error updating setting:', error);
                    controls.status.textContent = 'Error updating settings. Please refresh.';
                }
            }

            // Add stats refresh mechanism
            function refreshStats() {
                chrome.runtime.sendMessage({ type: 'statsRequest' }, response => {
                    if (response?.success && response.stats) {
                        updateStats(response.stats);
                    }
                });
            }

            // Add periodic stats refresh
            setInterval(refreshStats, 5000);

            function notifyTabs(settings) {
                chrome.tabs.query({}, async tabs => {
                    const promises = tabs.map(async tab => {
                        if (tab.status === 'complete') {
                            try {
                                await new Promise((resolve, reject) => {
                                    const timeout = setTimeout(() => {
                                        reject(new Error('Message timeout'));
                                    }, 1000); // 1 second timeout

                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'settingsUpdate',
                                        settings: settings
                                    }, response => {
                                        clearTimeout(timeout);
                                        if (chrome.runtime.lastError) {
                                            // Ignore "receiving end does not exist" errors
                                            if (!chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                                                console.warn(`Tab ${tab.id} message error:`, chrome.runtime.lastError);
                                            }
                                        }
                                        resolve(response);
                                    });
                                });
                            } catch (error) {
                                // Handle timeout or other errors
                                console.warn(`Tab ${tab.id} communication failed:`, error);
                            }
                        }
                    });

                    await Promise.allSettled(promises);
                });
            }

            function updateControls(settings) {
                try {
                    const sensitivityValue = Math.round((0.5 - settings.threshold) / 0.08);
                    controls.threshold.value = sensitivityValue;
                    controls.sensitivityDisplay.textContent = getSensitivityLabel(sensitivityValue);
                    controls.highContrast.checked = settings.highContrast;
                    document.body.classList.toggle('high-contrast', settings.highContrast);
                } catch (error) {
                    console.error('Error updating controls:', error);
                    controls.status.textContent = 'Error updating display';
                }
            }

            function updateStats(stats) {
                if (!stats) return;

                controls.flashCount.textContent = stats.flashCount.toLocaleString();
                controls.lastDetection.textContent = stats.lastDetection ?
                    new Date(stats.lastDetection).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'medium'
                    }) : 'Never';

                // Always show active status
                const protectionStatus = document.getElementById('protectionStatus');
                if (protectionStatus) {
                    protectionStatus.textContent = 'Active';
                    protectionStatus.style.color = '#2ecc71';
                }
            }

            const ANNOUNCE_CHANGE_TIMEOUT = 2000;

            function announceChange(message) {
                controls.status.textContent = message;
                setTimeout(() => {
                    controls.status.textContent = 'Protection Active';
                }, ANNOUNCE_CHANGE_TIMEOUT);
            }

            // Add reset stats functionality
            document.getElementById('resetStats').addEventListener('click', () => {
                const newStats = { flashCount: 0, lastDetection: null };
                chrome.storage.sync.set({ stats: newStats });
                updateStats(newStats);
                announceChange('Statistics reset');
            });

            // Enhanced message listener with error handling
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'statsUpdate') {
                    try {
                        updateStats(request.stats);
                    } catch (error) {
                        console.error('Error updating stats:', error);
                    }
                }
            });

            // Initialize with saved preferences
            chrome.storage.sync.get({
                userPreferences: {
                    highContrast: false,
                    lastSensitivity: 3
                }
            }, (result) => {
                const { highContrast } = result.userPreferences;
                controls.highContrast.checked = highContrast;
                document.body.classList.toggle('high-contrast', highContrast);
            });

            // Validate input values
            function validateValue(value, min, max) {
                return Math.min(Math.max(Number(value), min), max);
            }

        } catch (error) {
            console.error('[Security] Popup initialization error:', error);
        }
    });

    // Initialize with recovery mechanism
    document.addEventListener('DOMContentLoaded', () => {
        try {
            initializeSettings();
        } catch (error) {
            console.error('[Security] Popup initialization error:', error);
        }
    });
})();
