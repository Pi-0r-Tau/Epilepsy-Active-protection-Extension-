"use strict";
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "clicked_browser_action") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var activeTab = tabs;
            chrome.tabs.sendMessage(activeTab.id, { "message": "clicked_browser_action" });
            console.log(activeTab.url);
        });
    }
});