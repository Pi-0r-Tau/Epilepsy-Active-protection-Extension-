'use strict';

(function() {
    // Sanitize DOM queries
    function safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element not found: ${id}`);
        }
        return element;
    }

    document.addEventListener('DOMContentLoaded', () => {
        try {
            const controls = Object.freeze({
                threshold: safeGetElement('threshold'),
                highContrast: safeGetElement('high-contrast'),
                sensitivityDisplay: safeGetElement('sensitivityDisplay'),
                status: safeGetElement('status'),
                flashCount: safeGetElement('flashCount'),
                lastDetection: safeGetElement('lastDetection')
            });

            let userPreferences = {
                highContrast: false,
                lastSensitivity: 3
            };

            // Add sensitivity labels
            const SENSITIVITY_LABELS = {
                1: 'Very Low',
                2: 'Low',
                3: 'Medium',
                4: 'High',
                5: 'Very High'
            };

            function getSensitivityLabel(value) {
                return SENSITIVITY_LABELS[value] || 'Medium';
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

            let settingsUpdateTimeout = null;
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

                    const batch = {};
                    const callbacks = new Map();

                    this.pending.forEach((item, key) => {
                        batch[key] = item.value;
                        callbacks.set(key, { resolve: item.resolve, reject: item.reject });
                    });
                    this.pending.clear();

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
                    } finally {
                        this.processing = false;
                        if (this.pending.size > 0) {
                            setTimeout(() => this.process(), 1000);
                        }
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

                        storageQueue.update('threshold', threshold)
                            .then(() => {
                                // Notify tabs only after successful storage
                                chrome.tabs.query({}, (tabs) => {
                                    tabs.forEach(tab => {
                                        chrome.tabs.sendMessage(tab.id, {
                                            type: 'settingsUpdate',
                                            settings: { threshold, sensitivity: value }
                                        }).catch(() => {/* Ignore connection errors */});
                                    });
                                });
                            })
                            .catch(error => {
                                console.error('Failed to save settings:', error);
                                controls.status.textContent = 'Error saving settings';
                            });
                    }
                } catch (error) {
                    console.error('Error updating setting:', error);
                    controls.status.textContent = 'Error updating settings';
                }
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

            function announceChange(message) {
                controls.status.textContent = message;
                setTimeout(() => {
                    controls.status.textContent = 'Protection Active';
                }, 2000);
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
})();
