"use strict";

const DEFAULT_THRESHOLD = "50";
const DEFAULT_DIMMING_LEVEL = "50";
const DEFAULT_BLACKOUT = false;

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
                    status.textContent = 'Error saving settings!';
                    status.style.color = 'red';
                } else {
                    console.log("Message sent to background script");
                    status.textContent = 'Settings saved!';
                    status.style.color = 'green';
                }
                setTimeout(() => {
                    status.textContent = '';
                }, 2000);
            });
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(['threshold', 'dimmingLevel', 'blackout'], (result) => {
            thresholdRangeInput.value = result.threshold !== undefined ? result.threshold : DEFAULT_THRESHOLD;
            dimmingLevelInput.value = result.dimmingLevel !== undefined ? result.dimmingLevel : DEFAULT_DIMMING_LEVEL;
            blackoutCheckbox.checked = result.blackout !== undefined ? result.blackout : DEFAULT_BLACKOUT;
        });
    }

    thresholdRangeInput.addEventListener('change', saveSettings);
    dimmingLevelInput.addEventListener('input', saveSettings);
    blackoutCheckbox.addEventListener('change', saveSettings);

    loadSettings();
});