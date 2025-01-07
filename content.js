"use strict";

function detectFlashingLights(videoElement, threshold = 50, frameRate = 10, bufferTime = 3, blackout = false, dimmingLevel = 50) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    function initializeCanvas() {
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 360;
        console.log(`Canvas initialized: ${canvas.width}x${canvas.height}`);
    }

    let prevFrame = null;
    let frameCount = 0;
    const bufferFrames = [];
    const bufferSize = bufferTime * frameRate;
    let dimmed = false;
    let noFlashTimer = null;
    let undimming = false;
    let flashTimestamps = [];
    let blackoutActive = false;
    let blackoutTimer = null;

    function applyBlackout() {
        videoElement.style.filter = 'brightness(0%)';
        blackoutActive = true;
        clearTimeout(blackoutTimer);
        blackoutTimer = setTimeout(() => {
            videoElement.style.filter = '';
            blackoutActive = false;
            handlePostBlackout();
        }, 5000);
        console.log("Blackout applied.");
    }

    function handlePostBlackout() {
        if (flashTimestamps.length > 0) {
            console.log("Flashes detected after blackout. Applying dimming.");
            videoElement.style.filter = `brightness(${dimmingLevel}%)`;
            dimmed = true;
            flashTimestamps = [];
        }
    }

    function analyzeFrame() {
        if (videoElement.paused || videoElement.ended) return;
        frameCount++;
        if (frameCount % frameRate !== 0) {
            requestAnimationFrame(analyzeFrame);
            return;
        }

        if (canvas.width === 0 || canvas.height === 0) {
            initializeCanvas();
        }

        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const grayFrame = new Uint8Array(canvas.width * canvas.height);
        const grayFrameLength = grayFrame.length;
        const frameDataLength = frame.data.length;

        for (let i = 0; i < frameDataLength; i += 4) {
            grayFrame[i / 4] = 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
        }

        bufferFrames.push(grayFrame);
        if (bufferFrames.length > bufferSize) {
            bufferFrames.shift();
        }

        if (prevFrame) {
            processFrameDifference(grayFrame, grayFrameLength);
        }

        prevFrame = grayFrame;
        requestAnimationFrame(analyzeFrame);
    }

    function processFrameDifference(grayFrame, grayFrameLength) {
        let diffSum = 0;
        for (let i = 0; i < grayFrameLength; i++) {
            diffSum += Math.abs(grayFrame[i] - prevFrame[i]);
        }
        const meanDiff = diffSum / grayFrameLength;
        console.log(`Mean difference: ${meanDiff}, Threshold: ${threshold}`);
        if (meanDiff >= 120 || meanDiff > threshold) {
            console.log("Flashing light detected! Immediate blackout.");
            applyBlackout();
            flashTimestamps = [];
        } else if (undimming) {
            resetNoFlashTimer();
        }
    }

    function resetNoFlashTimer() {
        clearTimeout(noFlashTimer);
        noFlashTimer = setTimeout(() => {
            if (!blackoutActive) {
                graduallyUndimVideo();
            }
        }, 10000);
    }

    function graduallyUndimVideo() {
        let brightness = dimmingLevel;
        undimming = true;
        const interval = setInterval(() => {
            brightness += 5;
            videoElement.style.filter = `brightness(${brightness}%)`;
            if (brightness >= 100) {
                clearInterval(interval);
                undimming = false;
                videoElement.style.filter = '';
            }
        }, 500);
    }

    videoElement.addEventListener('seeked', () => {
        if (blackoutActive) {
            applyBlackout();
        }
    });

    initializeCanvas();
    analyzeFrame();
}

function detectFlashingLightsInIframe(iframe, threshold, blackout, dimmingLevel) {
    try {
        const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
        const videoElements = iframeDocument.querySelectorAll('video');
        console.log(`Found ${videoElements.length} video elements in iframe.`);
        videoElements.forEach(video => {
            video.addEventListener('play', () => {
                detectFlashingLights(video, threshold, 10, 3, blackout, dimmingLevel);
            });
        });
    } catch (error) {
        console.error("Error accessing iframe content:", error);
    }
}

chrome.storage.sync.get(['threshold', 'blackout', 'dimmingLevel'], (result) => {
    const threshold = result.threshold !== undefined ? parseInt(result.threshold) : 3;
    const blackout = result.blackout !== undefined ? result.blackout : false;
    const dimmingLevel = result.dimmingLevel !== undefined ? parseInt(result.dimmingLevel) : 50;
    console.log(`Threshold set to: ${threshold}, Blackout: ${blackout}, Dimming Level: ${dimmingLevel}`);
    const videoElements = document.querySelectorAll('video');
    console.log(`Found ${videoElements.length} video elements.`);
    videoElements.forEach(video => {
        video.addEventListener('play', () => {
            detectFlashingLights(video, threshold, 10, 3, blackout, dimmingLevel);
        });
    });

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.addEventListener('load', () => {
            detectFlashingLightsInIframe(iframe, threshold, blackout, dimmingLevel);
        });
    });
});