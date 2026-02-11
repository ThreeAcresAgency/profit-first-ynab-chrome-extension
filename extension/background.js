// Track which tabs have the content script
const injectedTabs = new Set();

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('app.ynab.com') && 
        !injectedTabs.has(tabId)) {
        
        console.log('Injecting content script into tab:', tabId);
        
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['ynab-content.js']
        }).then(() => {
            console.log('Content script injected successfully');
            injectedTabs.add(tabId);
        }).catch(err => {
            console.error('Failed to inject content script:', err);
        });
    }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    if (message.type === 'INJECT_CONTENT_SCRIPT') {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0] && !injectedTabs.has(tabs[0].id)) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['ynab-content.js']
                }).then(() => {
                    console.log('Content script injected on demand');
                    injectedTabs.add(tabs[0].id);
                    sendResponse({ success: true });
                }).catch(err => {
                    console.error('Failed to inject content script:', err);
                    sendResponse({ success: false, error: err.message });
                });
                return true; // Keep message channel open for async response
            } else {
                sendResponse({ success: true, alreadyInjected: true });
            }
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'INJECT_SCRIPT') {
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['ynab-content.js']
        }).then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            console.error('Script injection failed:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
});
