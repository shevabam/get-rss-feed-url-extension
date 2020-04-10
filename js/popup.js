
/**
 * Get RSS feeds URLs
 */
function getFeedsURLs(url, callback) {

    // Check if it's a Youtube URL (channel or user feed)
    var ytRss = getYoutubeRss(url);

    // Check if it's a Reddit URL
    var rdRss = getRedditRss(url);

    if (ytRss !== false)
    {
        var feeds_urls = [];
        
        var feed = {
            type: '',
            url: ytRss,
            title: ytRss,
        };
        
        feeds_urls.push(feed);

        callback(feeds_urls);
    }
    else if (rdRss !== false)
    {
        var feeds_urls = [];
        
        var feed = {
            type: '',
            url: rdRss,
            title: rdRss,
        };
        
        feeds_urls.push(feed);

        callback(feeds_urls);
    }
    else
    {
        var x = new XMLHttpRequest();
        x.open('GET', url);

        x.responseType = '';
        x.onload = function() {
            var response = x.response;

            var feeds_urls = [];
            var types = [
                'application/rss+xml',
                'application/atom+xml',
                'application/rdf+xml',
                'application/rss',
                'application/atom',
                'application/rdf',
                'text/rss+xml',
                'text/atom+xml',
                'text/rdf+xml',
                'text/rss',
                'text/atom',
                'text/rdf'
            ];

            document.getElementById('rss-feed-url_response').innerHTML = response;

            var links = document.getElementById('rss-feed-url_response').querySelectorAll("#rss-feed-url_response link[type]");

            document.getElementById('rss-feed-url_response').innerHTML = '';

            for (var i = 0; i < links.length; i++)
            {
                if (links[i].hasAttribute('type') && types.indexOf(links[i].getAttribute('type')) !== -1)
                {
                    feed_url = links[i].getAttribute('href');

                    // If feed's url starts with "//"
                    if (feed_url.indexOf("//") == 0)
                        feed_url = "http:" + feed_url;
                    // If feed's url starts with "/"
                    else if (feed_url.startsWith('/'))
                        feed_url = url.split('/')[0] + '//' + url.split('/')[2] + feed_url;
                    // If feed's url starts with http or https
                    else if (/^(http|https):\/\//i.test(feed_url))
                        feed_url = feed_url;
                    else
                        feed_url = url + "/" + feed_url.replace(/^\//g, '');

                    var feed = {
                        type: links[i].getAttribute('type'),
                        url: feed_url,
                        title: links[i].getAttribute('title') || feed_url
                    };

                    feeds_urls.push(feed);
                }
            }

            callback(feeds_urls);
        };

        x.onerror = function() {
            render('Unable to find feed');
        };

        x.send();
    }
}



/*
 * Get RSS feed URL of Youtube channel or user
 */
function getYoutubeRss(tabUrl)
{
    // Check if Youtube URL
    var regex = RegExp(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/gm);

    var isYTUrl = regex.test(tabUrl);
    
    if (isYTUrl)
    {
        // Remove after "?"
        tabUrl = tabUrl.split('?')[0];

        var channel = '';

        // https://www.youtube.com/channel/UCENv8pH4LkzvuSV_qHIcslg
        // https://www.youtube.com/user/cestpassorcierftv/featured
        if (tabUrl.split('channel/')[1])
        {
            channel = "channel_id=" + (tabUrl.split('channel/')[1]).split('/')[0]; 
        }
        else if (tabUrl.split('user/')[1])
        {
            channel = "user=" + (tabUrl.split('user/')[1]).split('/')[0];
        }

        if (channel != '')
            return "https://www.youtube.com/feeds/videos.xml?" + channel;
        else
            return false;
    }
    else
    {
        return false;
    }
}


/*
 * Get RSS feed URL of a subreddit
 */
function getRedditRss(tabUrl)
{
    // Check if subreddit URL
    var regex = RegExp(/^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)/gm);

    var isRedditUrl = regex.test(tabUrl);
    
    if (isRedditUrl)
    {
        // Remove last "/" if presents
        var feedUrl = tabUrl.replace(/\/$/, '');
        feedUrl = feedUrl + '.rss';

        if (feedUrl != tabUrl)
            return feedUrl;
        else
            return false;
    }
    else
    {
        return false;
    }
}


/**
 * Prints message in #feeds
 */
function render(msg)
{
    document.getElementById('feeds').innerHTML = msg;
}

/*
 * Copy to clipboard text with notification
 */
function copyToClipboard(text, notification) {
    const input = document.createElement('textarea');
    input.style.position = 'fixed';
    input.style.opacity = 0;
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('Copy');
    document.body.removeChild(input);

    chrome.notifications.create('get-rss-feed-url-copy', {
        type: "basic",
        title: notification.title ?? "Get RSS Feeds URLs",
        message: notification.message,
        iconUrl: "img/notif_"+notification.type+".png"
    });
};



document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        var url = tab.url;

        getFeedsURLs(url, function(feeds){

            if (feeds.length > 0)
            {
                var html = '<table>';
                for (i = 0; i < feeds.length; i++)
                {
                    html += '<tr>';
                    html +=   '<td class="feed-title">';
                    html +=     '<a class="link" href="'+feeds[i].url+'" title="Open feed URL" data-tabtitle="'+tab.title+'" target="_blank">'+feeds[i].title+'</a>';
                    html +=   '</td>';
                    html +=   '<td class="feed-copy">';
                    html +=     '<a class="copyLink" title="Copy feed URL" href="#">Copy URL</a>';
                    html +=   '</td>';
                    html += '</tr>';
                }
                html += '</table>';

                render(html);
            }
            else
            {
                render("No feed found");
            }

            
            // Copy to clipboard feed URL
            var copyButtons = document.getElementsByClassName('copyLink');

            for (let i = 0; i < copyButtons.length; i++) {
                copyButtons[i].addEventListener("click", function() {
                    console.log(this.parentNode);

                    var feed = this.parentNode.parentNode.querySelector('a.link');
                    var url = feed.getAttribute('href');
                    var tabTitle = feed.getAttribute('data-tabtitle');

                    copyToClipboard(url, {type: "success", title: tabTitle, message: "Feed URL copied in clipboard!"});
                });
            }

        });
    });
});



