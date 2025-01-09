"use strict";

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.message === "clicked_browser_action" || request.threshold !== undefined || request.dimmingLevel !== undefined || request.blackout !== undefined) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const activeTab = tabs; // Correctly reference the first tab
                chrome.tabs.sendMessage(activeTab.id, request, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending message to tab:", chrome.runtime.lastError);
                        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                    } else {
                        console.log("Message sent to tab:", activeTab.url);
                        console.log("Response from content script:", response);
                        sendResponse({ status: "success", message: "Settings updated", response });
                    }
                });
            } else {
                console.error("No active tab found.");
                sendResponse({ status: "error", message: "No active tab found" });
            }
        });
    } else {
        console.error("Invalid request:", request);
        sendResponse({ status: "error", message: "Invalid request" });
    }
    return true; // Indicate that the response will be sent asynchronously
});