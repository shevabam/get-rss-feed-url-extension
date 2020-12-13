
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    /* chrome.browserAction.setIcon({path: {"48": "/img/icon_grey-48.png"}, tabId: tabId});
    chrome.browserAction.setBadgeText({text: "", tabId: tabId}); */

    var nbFeeds = 0;

    if (changeInfo.status == 'complete' && tab.active) {

        getFeedsURLs(tab.url, function(feeds){

            nbFeeds = feeds.length;

            // console.log(nbFeeds);

            if (nbFeeds == 0) {
                chrome.browserAction.setIcon({path: {"48": "/img/icon_grey-48.png"}, tabId: tabId});
                chrome.browserAction.setBadgeText({text: "", tabId: tabId});
            }
            else {
                chrome.browserAction.setIcon({path: {"48": "/img/icon_default-48.png"}, tabId: tabId});
                chrome.browserAction.setBadgeText({text: nbFeeds.toString(), tabId: tabId});
            }

        });

    }
})