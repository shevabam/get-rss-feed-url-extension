document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tab = tabs[0];
        const url = tab.url;

        getFeedsURLs(url, function(feeds){

            // Send feed count to background to update badge
            chrome.runtime.sendMessage({
                action: "updateBadge",
                tabId: tab.id,
                feedCount: feeds.length
            });

            if (feeds.length > 0) {
                let html = '<table id="feeds-list">';
                for (let i = 0; i < feeds.length; i++) {
                    html += '<tr>';
                    html +=   '<td class="feed-title">';
                    html +=     '<a class="link" href="'+feeds[i].url+'" title="Open feed URL" data-tabtitle="'+tab.title+'" target="_blank">'+feeds[i].title+'</a>';
                    html +=     '<span class="feed-url">'+truncate(feeds[i].url, 50)+'</span>';
                    html +=   '</td>';
                    html +=   '<td class="feed-copy">';
                    html +=     '<a class="copyButton copyLink" title="Copy feed URL" href="#">Copy URL</a>';
                    html +=   '</td>';
                    html += '</tr>';
                }
                html += '</table>';

                html += '<div class="copyAllLinks-container">';
                html +=   '<a id="copyAllLinks" class="" title="Copy all feeds URLs" href="#">Copy all URLs</a>';
                html += '</div>';

                render(html);


                // Copy to clipboard feed URL
                const copyButtons = document.getElementsByClassName('copyLink');

                for (let i = 0; i < copyButtons.length; i++) {
                    copyButtons[i].addEventListener("click", function() {
                        const feed = this.parentNode.parentNode.querySelector('a.link');
                        const url = feed.getAttribute('href');
                        const tabTitle = feed.getAttribute('data-tabtitle');
    
                        copyToClipboard(url, {type: "success", title: tabTitle, message: "Feed URL copied in clipboard!"});
                    });
                }
    
                
                // Copy to clipboard all feeds URLs
                const copyButtonAll = document.getElementById('copyAllLinks');

                copyButtonAll.addEventListener("click", function() {
                    const feeds_list = document.getElementById('feeds-list').querySelectorAll('.feed-title a.link');

                    let text = '';
                    for (let j = 0; j < feeds_list.length; j++) {
                        text += feeds_list[j].getAttribute('href') + "\n";
                    }
                    const textToCopy = text.substring(0, text.length - 1);
    
                    copyToClipboard(textToCopy, {type: "success", title: '', message: "Feeds URLs copied in clipboard!"});
                });
                
            } else {
                render("No feed found");
            }

        });
    });
});


