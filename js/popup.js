document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        var url = tab.url;

        getFeedsURLs(url, function(feeds){

            if (feeds.length > 0) {
                var html = '<table id="feeds-list">';
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
                var copyButtons = document.getElementsByClassName('copyLink');
    
                for (let i = 0; i < copyButtons.length; i++) {
                    copyButtons[i].addEventListener("click", function() {
                        var feed = this.parentNode.parentNode.querySelector('a.link');
                        var url = feed.getAttribute('href');
                        var tabTitle = feed.getAttribute('data-tabtitle');
    
                        copyToClipboard(url, {type: "success", title: tabTitle, message: "Feed URL copied in clipboard!"});
                    });
                }
    
                
                // Copy to clipboard all feeds URLs
                var copyButtonAll = document.getElementById('copyAllLinks');
    
                copyButtonAll.addEventListener("click", function() {
                    var feeds_list = document.getElementById('feeds-list').querySelectorAll('.feed-title a.link');
    
                    var text = '';
                    for (var j = 0; j < feeds_list.length; j++) {
                        text += feeds_list[j].getAttribute('href') + "\n";
                    }
                    var textToCopy = text.substring(0, text.length - 1);
    
                    copyToClipboard(textToCopy, {type: "success", title: '', message: "Feeds URLs copied in clipboard!"});
                });
                
            } else {
                render("No feed found");
            }

        });
    });
});


