'use strict';
/**
 * @description FlashProtector configuration and state management 
 */
const FlashProtector = {
    /**
     * Configuration settings for FlashProtector
     * @type {Object}
     * @property {number} threshold - The threshold for flash protection
     * @property {number} frameSampleRate - The rate in which frames are sampled
     * @property {boolean} debugMode - Flag to enable or disable debug mode
     * @property {number} blackoutDuration - Duration of blackout in miliseconds
     * @property {number} fadeOutDuration - Duration of fade out in miliseconds
     * @property {number} overlayOpacity - Opacity of the overlay
     * @property {number} fadeInDuration - Duration of fade in of blackout in miliseconds
     * @property {number} storageDebounceTime - Debounce time for storage updates in miliseconds
     * @property {boolean} protectionEnabled - Flag to enable or disable protection
     * @property {number} protectionLevel - Level of protection
     * @property {number} seekProtectionDuration - Duration of protection after seeking in miliseconds
     * @property {number} seekFadeOutDuration - Duration of fade out after seeking in miliseconds
     * 
     */
    config: {
        threshold: 0.25,
        frameSampleRate: 30,
        debugMode: false,
        blackoutDuration: 5000, // 5 seconds in milliseconds
        fadeOutDuration: 300,
        overlayOpacity: 0.8,
        fadeInDuration: 1,    // Quick fade to black in ms
        storageDebounceTime: 1000, // 1 second between storage updates
        protectionEnabled: true,  // Always enabled
        protectionLevel: 5,      // Always maximum protection
        seekProtectionDuration: 3000, // 3 seconds protection after seeking
        seekFadeOutDuration: 1000    // 1 second fade out if no flashes detected
    },
    /** 
     * State management for FlashProtector
     * @type {Object}
     * @property {number} lastBrightness - The last recorded brightness level
     * @property {number} lastFrameTime - The timestamp of the last processed frame
     * @property {HTMLCanvasElement} canvas - The canvas element used for processing
     * @property {CanvasRenderingContext2D|null} context - The 2D context of the Canvas
     * @property {WeakSet<HTMLVideoElement>} activeVideos - Set of active video elements
     * @property {boolean} isIframe - Flag indicating if the script is running in an iframe
     * @property {WeakMap<HTMLVideoElement>, number} activeTimers - Map of timers for each video element
     * @property {Object} stats - Statistics related to flash detection
     * @property {number} stats.flashCount - The count of detected flashes
     * @property {Date|null} stats.lastDetection - The timestamp of the last detected flash
     * @property {HTMLElement|null} announcer - The element used for announcements
     * @property {number} lastStorageUpdate - The timestamp of the last storage update
     * @property {Object|null} pendingStats - Pending stats to be updated
     * @property {number} currentSensitivity - The current sensitivity setting
     */
    state: {
        lastBrightness: 0,
        lastFrameTime: 0,
        canvas: document.createElement('canvas'),
        context: null,
        activeVideos: new WeakSet(),
        isIframe: window !== window.top,
        activeTimers: new WeakMap(), // Store timers for each video
        stats: {
            flashCount: 0,
            lastDetection: null
        },
        announcer: null,
        lastStorageUpdate: 0,
        pendingStats: null,
        currentSensitivity: 0.25
    },

    init() {
        try {
            // Initialize connection with background script
            chrome.runtime.sendMessage({ type: 'connect' }, response => {
                if (response?.success) {
                    this.debug('Connected to background script');
                }
            });

            this.state.context = this.state.canvas.getContext('2d', { willReadFrequently: true });
            this.state.isIframe = window !== window.top;
            this.createAnnouncer();

            // Load settings but enforce maximum protection
            chrome.storage.sync.get({
                threshold: 0.25,
                userPreferences: {
                    lastSensitivity: 3
                }
            }, (settings) => {
                this.config.threshold = 0.5 - (settings.userPreferences.lastSensitivity * 0.08);
            });

            // Listener for real time updates
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.threshold) {
                    this.config.threshold = changes.threshold.newValue;
                    this.state.currentSensitivity = changes.threshold.newValue;
                    this.updateActiveBrightness();
                }
            });

            // Load and apply saved theme preference
            chrome.storage.sync.get({
                userPreferences: {
                    highContrast: false
                }
            }, (result) => {
                if (result.userPreferences.highContrast) {
                    document.body.classList.add('high-contrast');
                }
            });

            // Listen for theme changes
            chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
                if (message.type === 'themeChange') {
                    document.body.classList.toggle('high-contrast', message.highContrast);
                    sendResponse({ success: true });
                }
                return true;
            });

            this.setupMutationObserver();
            this.protectExistingVideos();

            // YouTube to videos in iframes
            if (window.location.hostname.includes('youtube.com')) {
                this.setupYouTubeHandler();
            }

            // Loads existing stats from videos played or being played
            chrome.storage.sync.get(['stats'], (result) => {
                if (result.stats) {
                    this.state.stats = result.stats;
                }
            });

            this.debug('Flash Protector initialized in ' + (this.state.isIframe ? 'iframe' : 'main window'));
        } catch (error) {
            console.error('Flash Protector initialization failed:', error);
        }
    },

    applySettings() {
        if (this.state.activeVideos.size > 0) {
            this.state.activeVideos.forEach(video => {
                if (!this.config.protectionEnabled) {
                    this.resetBrightness(video);
                }
            });
        }
    },

    createAnnouncer() {
        this.state.announcer = document.createElement('div');
        this.state.announcer.setAttribute('role', 'alert');
        this.state.announcer.setAttribute('aria-live', 'polite');
        this.state.announcer.className = 'flash-protection-announcer';
        this.state.announcer.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
        document.body.appendChild(this.state.announcer);
    },

    /**
     * Announces a message using the announcer element
     * @param {string} message - The message to announce
     */

    announce(message) {
        if (this.state.announcer) {
            this.state.announcer.textContent = message;
        }
    },

    updateStats(flashDetected = false) {
        if (flashDetected) {
            this.state.stats.flashCount++;
            this.state.stats.lastDetection = new Date().toISOString();
        }

        // Send message with retry
        const sendStatsUpdate = (retries = 3) => {
            chrome.runtime.sendMessage({
                type: 'statsUpdate',
                stats: this.state.stats
            }).catch(error => {
                if (retries > 0) {
                    setTimeout(() => sendStatsUpdate(retries - 1), 1000);
                }
            });
        };

        sendStatsUpdate();

        // Debounce storage updates due to max_write_operations_per_hour issues
        const now = Date.now();
        if (now - this.state.lastStorageUpdate > this.config.storageDebounceTime) {
            // If enough time has passed, update storage
            chrome.storage.sync.set({ stats: this.state.stats });
            this.state.lastStorageUpdate = now;
            this.state.pendingStats = null;
        } else {
            // If not schedule update
            if (!this.state.pendingStats) {
                this.state.pendingStats = setTimeout(() => {
                    chrome.storage.sync.set({ stats: this.state.stats });
                    this.state.lastStorageUpdate = Date.now();
                    this.state.pendingStats = null;
                }, this.config.storageDebounceTime);
            }
        }

        // Always notify popup immediately
        chrome.runtime.sendMessage({
            type: 'statsUpdate',
            stats: this.state.stats
        });
    },

    setupYouTubeHandler() {
        this.debug('Setting up YouTube handler');
        // Monitor for video player initialization
        const checkForPlayer = setInterval(() => {
            const player = document.querySelector('.html5-video-player');
            if (player) {
                clearInterval(checkForPlayer);
                this.protectExistingVideos();
            }
        }, 1000);
    },

    setupMutationObserver() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'VIDEO') {
                        this.protectVideo(node);
                    } else if (node.getElementsByTagName) {
                        // Convert HTMLCollection to Array before using forEach
                        Array.from(node.getElementsByTagName('video'))
                            .forEach(video => this.protectVideo(video));
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    protectExistingVideos() {
        // Use querySelectorAll instead of previous as it was better in testing
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
            this.debug(`Found ${videos.length} existing videos`);
            videos.forEach(video => this.protectVideo(video));
        }
    },

    protectVideo(video) {
        if (!video || this.state.activeVideos.has(video)) return;

        try {
            // Prevent autoplay
            video.autoplay = false;
            video.setAttribute('autoplay', 'false');
            video.pause();
            video.classList.add('flash-protected-video');

            // Monitors and prevents autoplay attempts
            const autoplayObserver = new MutationObserver(() => {
                if (!video.paused) {
                    video.pause();
                    this.debug('Prevented autoplay attempt');
                }
            });

            autoplayObserver.observe(video, {
                attributes: true,
                attributeFilter: ['autoplay']
            });

            // Check if video is visible/rendered
            if (video.offsetParent === null) {
                this.debug('Video not visible, skipping protection');
                return;
            }

            // CSS transition for smooth brightness changes
            video.style.transition = 'filter 0.3s ease';

            this.state.activeVideos.add(video);

            // ARIA attributes for accessibility
            video.setAttribute('aria-label', 'Protected video with flash detection');

            // Adds keyboard shortcut for manual toggle
            video.parentElement.addEventListener('keydown', (e) => {
                if (e.altKey && e.key === 'b') {
                    this.triggerBlackout(video);
                }
            });

            // Enhanced keyboard controls for ease of use
            const handleKeyboard = (e) => {
                // Check if focus is on video or video container
                const isVideoFocused = document.activeElement === video ||
                                     document.activeElement === video.parentElement;

                if (e.altKey) {
                    switch (e.key.toLowerCase()) {
                        case 'b':
                            e.preventDefault();
                            this.triggerBlackout(video);
                            break;
                        case 's':
                            e.preventDefault();
                            this.adjustSensitivity(0.08);
                            break;
                        case 'd':
                            e.preventDefault();
                            this.adjustSensitivity(-0.08);
                            break;
                    }
                } else if (isVideoFocused) {
                    switch (e.key) {
                        case 'Escape':
                            e.preventDefault();
                            this.resetBrightness(video);
                            break;
                        case ' ':
                            e.preventDefault();
                            if (video.paused) {
                                video.play();
                            } else {
                                video.pause();
                            }
                            break;
                    }
                }
            };

            // Keyboard listeners to both video and its container
            video.addEventListener('keydown', handleKeyboard, true);
            video.parentElement.addEventListener('keydown', handleKeyboard, true);
            video.tabIndex = 0;
            video.parentElement.tabIndex = 0;
            video.style.outline = 'none';
            video.parentElement.style.outline = 'none';
            video.addEventListener('focus', () => {
                video.style.outline = '2px solid #0066cc';
            });
            video.addEventListener('blur', () => {
                video.style.outline = 'none';
            });

            // Prevents duplication by removing the existing event listener.
            const existingHandler = video.parentElement.getAttribute('data-keyboard-handler');
            if (existingHandler) {
                video.parentElement.removeEventListener('keydown', window[existingHandler]);
            }

            // Store new handler reference
            const handlerId = `handler_${Math.random().toString(36).substr(2, 9)}`;
            window[handlerId] = handleKeyboard;
            video.parentElement.setAttribute('data-keyboard-handler', handlerId);

            // Protection logic
            let frameCheckHandle;
            const stopProtection = () => {
                if (frameCheckHandle) {
                    cancelAnimationFrame(frameCheckHandle);
                    frameCheckHandle = null;
                }
                // Ensure video returns to normal brightness when stopped
                this.resetBrightness(video);
            };

            const startProtection = () => {
                let lastAnalysisTime = 0;

                /**
                 * Checks the brightness of the current video frame
                 * @param {DOMHighResTimeStamp} timestamp - The current timestamp
                 * 
                 */

                const checkFrame = (timestamp) => {
                    if (video.paused || video.ended) {
                        stopProtection();
                        return;
                    }

                    if (timestamp - lastAnalysisTime >= 1000 / this.config.frameSampleRate) {
                        try {
                            const brightness = this.analyzeBrightness(video);
                            if (Math.abs(brightness - this.state.lastBrightness) > this.config.threshold) {
                                this.triggerBlackout(video);  // Changed from triggerOverlay
                            }
                            this.state.lastBrightness = brightness;
                            lastAnalysisTime = timestamp;
                        } catch (error) {
                            this.debug('Frame analysis error:', error);
                        }
                    }

                    frameCheckHandle = requestAnimationFrame(checkFrame);
                };

                frameCheckHandle = requestAnimationFrame(checkFrame);
            };

            video.addEventListener('play', startProtection);
            video.addEventListener('pause', stopProtection);
            video.addEventListener('ended', stopProtection);
            video.addEventListener('seeking', () => {
                this.triggerSeekProtection(video);
            });
        } catch (error) {
            this.debug('Error protecting video:', error);
        }
    },

    // Triggers a blackout of the video element to protect (aim to protect) against flashes
    /**
     * 
     * @param {HTMLVideoElement} video - The video element to apply the blackout to
     * 
     */

    triggerBlackout(video) {
        if (!video) return;

        // Update stats
        this.updateStats(true);

        // Announce flash detection
        this.announce('Flash detected. Screen darkened for 5 seconds for protection.');

        // Clear any existing timer for this video
        const existingTimer = this.state.activeTimers.get(video);
        if (existingTimer) {
            clearTimeout(existingTimer.timeout);
            this.debug('Reset blackout timer');
        }

        // Apply blackout
        video.style.filter = 'brightness(0)';

        // Sets a new timer
        const timeoutId = setTimeout(() => {
            video.style.filter = 'brightness(1)';
            this.announce('Screen brightness restored');
            this.state.activeTimers.delete(video);
        }, this.config.blackoutDuration);

        // Store timer reference
        this.state.activeTimers.set(video, {
            timeout: timeoutId,
            startTime: Date.now()
        });

        this.debug('Video blackout activated for 5 seconds');
    },

    triggerSeekProtection(video) {
        if (!video) return;

        // Apply immediate blackout
        video.style.filter = 'brightness(0)';
        this.announce('Video seek detected. Temporary protection activated.');

        // Clear any existing timer
        const existingTimer = this.state.activeTimers.get(video);
        if (existingTimer) {
            clearTimeout(existingTimer.timeout);
        }

        let startTime = Date.now();
        let fadeInterval;

        // Set protection timer
        const timeoutId = setTimeout(() => {
            // Start gradual fade if no flashes detected
            fadeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, (elapsed - this.config.seekProtectionDuration) / this.config.seekFadeOutDuration);
                video.style.filter = `brightness(${progress})`;

                if (progress >= 1) {
                    clearInterval(fadeInterval);
                    this.announce('Protection restored to normal levels.');
                }
            }, 50);
        }, this.config.seekProtectionDuration);

        this.state.activeTimers.set(video, {
            timeout: timeoutId,
            fadeInterval: fadeInterval,
            startTime: startTime
        });
    },

    resetBrightness(video) {
        video.style.filter = 'brightness(1)';
        this.announce('Screen brightness restored');
    },

    /**
     * Analyzes the brightness of the video element
     * @param {HTMLVideoElement} video - The video element to analyze
     * @returns {number} The average brightness of video
     */

    analyzeBrightness(video) {
        if (!this.config.protectionEnabled) return 0;

        // Use current sensitivity for threshold adjustment 
        // TASK 233: adjustedThreshold is declared but value is never read
        const adjustedThreshold = this.state.currentSensitivity * (this.config.protectionLevel / 3);

        const { canvas, context } = this.state;
        const sampleSize = 4; // Sample every 4th pixel for performance

        canvas.width = video.videoWidth / sampleSize;
        canvas.height = video.videoHeight / sampleSize;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;

        let totalBrightness = 0;
        for (let i = 0; i < imageData.length; i += 4) {
            totalBrightness += (
                imageData[i] * 0.2126 +
                imageData[i + 1] * 0.7152 +
                imageData[i + 2] * 0.0722
            ) / 255;
        }

        return totalBrightness / (imageData.length / 4);
    },

    updateActiveBrightness() {
        if (this.state.activeVideos.size > 0) {
            this.state.activeVideos.forEach(video => {
                // Only update if video is currently playing
                if (!video.paused && !video.ended) {
                    const brightness = this.analyzeBrightness(video);
                    if (Math.abs(brightness - this.state.lastBrightness) > this.config.threshold) {
                        this.triggerBlackout(video);
                    }
                }
            });
        }
        this.debug('Updated sensitivity applied to active videos');
    },
    /**
     * Resets the brightness of all active videos
     */
    resetAllVideos() {
        this.state.activeVideos.forEach(video => {
            this.resetBrightness(video);
        });
    },
    /**
     * Adjusts the sensitivity of the flash protection
     * @param {*} change - The change in sensitivity level
     */
    adjustSensitivity(change) {
        const currentValue = Math.round((0.5 - this.config.threshold) / 0.08);
        const newValue = Math.max(1, Math.min(5, currentValue + (change > 0 ? 1 : -1)));
        const newThreshold = 0.5 - (newValue * 0.08);

        chrome.storage.sync.set({
            threshold: newThreshold,
            userPreferences: { lastSensitivity: newValue }
        });

        this.announce(`Sensitivity ${change > 0 ? 'increased' : 'decreased'} to ${
            ['Very Low', 'Low', 'Medium', 'High', 'Very High'][newValue - 1]
        }`);
    },

    /**
     * Logs debug messages if debug mode is enabled
     * @param  {...any} args - The messages or objects to log
     * @returns {void}
     */

    debug(...args) {
        if (this.config.debugMode) {
            console.log('[Flash Protector]', ...args);
        }
    }
};

// Initialize protection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FlashProtector.init());
} else {
    FlashProtector.init();
}