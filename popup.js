"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const thresholdRangeInput = document.getElementById('threshold-range');
    const dimmingLevelInput = document.getElementById('dimming-level');
    const blackoutCheckbox = document.getElementById('blackout');
    const status = document.getElementById('status');

    function saveSettings() {
        const threshold = thresholdRangeInput.value;
        const dimmingLevel = dimmingLevelInput.value;
        const blackout = blackoutCheckbox.checked;
        chrome.storage.sync.set({ threshold, dimmingLevel, blackout }, () => {
            status.textContent = 'Settings saved!';
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
            // Send message to background script to update settings
            chrome.runtime.sendMessage({ threshold, dimmingLevel, blackout }, (_response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending message to background script:", chrome.runtime.lastError);
                } else {
                    console.log("Message sent to background script");
                }
            });
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(['threshold', 'dimmingLevel', 'blackout'], (result) => {
            if (result.threshold !== undefined) {
                thresholdRangeInput.value = result.threshold;
            } else {
                thresholdRangeInput.value = "50"; // Default value
            }
            if (result.dimmingLevel !== undefined) {
                dimmingLevelInput.value = result.dimmingLevel;
            } else {
                dimmingLevelInput.value = "50"; // Default value
            }
            if (result.blackout !== undefined) {
                blackoutCheckbox.checked = result.blackout;
            } else {
                blackoutCheckbox.checked = false; // Default value
            }
        });
    }

    thresholdRangeInput.addEventListener('change', saveSettings);
    dimmingLevelInput.addEventListener('input', saveSettings);
    blackoutCheckbox.addEventListener('change', saveSettings);

    loadSettings();
});