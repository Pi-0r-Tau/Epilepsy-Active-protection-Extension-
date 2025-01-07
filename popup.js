"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const thresholdInput = document.getElementById('threshold');
    const dimmingLevelInput = document.getElementById('dimming-level');
    const blackoutCheckbox = document.getElementById('blackout');
    const status = document.getElementById('status');

    function saveSettings() {
        const threshold = thresholdInput.value;
        const dimmingLevel = dimmingLevelInput.value;
        const blackout = blackoutCheckbox.checked;
        chrome.storage.sync.set({ threshold, dimmingLevel, blackout }, () => {
            status.textContent = 'Settings saved!';
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(['threshold', 'dimmingLevel', 'blackout'], (result) => {
            if (result.threshold !== undefined) {
                thresholdInput.value = result.threshold;
            }
            if (result.dimmingLevel !== undefined) {
                dimmingLevelInput.value = result.dimmingLevel;
            }
            if (result.blackout !== undefined) {
                blackoutCheckbox.checked = result.blackout;
            }
        });
    }

    thresholdInput.addEventListener('input', saveSettings);
    dimmingLevelInput.addEventListener('input', saveSettings);
    blackoutCheckbox.addEventListener('change', saveSettings);

    loadSettings();
});