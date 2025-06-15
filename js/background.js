importScripts('utilities.js');
importScripts('functions.js');

chrome.tabs.onActivated.addListener(function(activeInfo) {
    // updateIcon(activeInfo.tabId);
});

//listen for current tab to be changed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // updateIcon(tabId);
});

async function updateIcon(tabId) {
    chrome.tabs.get(tabId, function(change){

        chrome.tabs.get(tabId, function(tab){
            var url = tab.url;

            getFeedsURLs(url, function(feeds){

                nbFeeds = feeds.length;

                // console.log('nbFeeds (bg) : '+nbFeeds);

                if (nbFeeds == 0) {
                    chrome.action.setIcon({path: {"48": "/img/icon_grey-48.png"}, tabId: tabId});
                    chrome.action.setBadgeText({text: "", tabId: tabId});
                }
                else {
                    chrome.action.setIcon({path: {"48": "/img/icon_default-48.png"}, tabId: tabId});
                    chrome.action.setBadgeText({text: nbFeeds.toString(), tabId: tabId});
                }

            });
        });
    });
};

async function removeAllContextMenus() {
    return new Promise((resolve) => {
        chrome.contextMenus.removeAll(() => {
            resolve();
        });
    });
}

async function createActionContextMenus() {
    await removeAllContextMenus();
    
    chrome.contextMenus.create({
        id: "support",
        title: "❤️ Support",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "issues",
        title: "🤔 Issues and Suggestions",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "github",
        title: "🌐 GitHub",
        parentId: "issues",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "reportIssue",
        title: "🐛 Report Issue",
        parentId: "issues",
        contexts: ["action"]
    });

    // Sous-menus de "Support"
    chrome.contextMenus.create({
        id: "donate",
        title: "🍕 Buy me a pizza",
        parentId: "support",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "review",
        title: "🌟 Leave a review",
        parentId: "support",
        contexts: ["action"]
    });
}

chrome.runtime.onInstalled.addListener(async () => {
    await createActionContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
    await createActionContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case "github":
            chrome.tabs.create({ url: 'https://github.com/shevabam/get-rss-feed-url-extension' });
            break;
        case "reportIssue":
            chrome.tabs.create({ url: 'https://github.com/shevabam/get-rss-feed-url-extension/issues' });
            break;
        case "donate":
            chrome.tabs.create({ url: 'https://buymeacoffee.com/shevabam' });
            break;
        case "review":
            chrome.tabs.create({ url: `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews` });
            break;
    }
});