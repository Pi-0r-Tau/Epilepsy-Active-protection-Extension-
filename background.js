"use strict";

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "clicked_browser_action") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, { message: "clicked_browser_action" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending message to tab:", chrome.runtime.lastError);
                    } else {
                        console.log("Message sent to tab:", activeTab.url);
                    }
                });
            } else {
                console.error("No active tab found.");
            }
        });
    }
});