
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
                    // If feed's has no slash
                    else if (!feed_url.match(/\//))
                        feed_url = url.substr(0, url.lastIndexOf("/")) + '/' + feed_url;
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

            if (feeds_urls.length === 0)
            {
                var test_feed = tryToGetFeedURL(url);
                if (test_feed !== null)
                    feeds_urls.push(test_feed);
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
function render(content)
{
    document.getElementById('feeds').innerHTML = content;
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
}


/*
 * Parse an URL to return host, protocol, ...
 */
function parseUrl(string) {
    const a = document.createElement('a'); 
    a.setAttribute('href', string);
    const {host, hostname, pathname, port, protocol, search, hash} = a;
    const origin = `${protocol}//${hostname}${port.length ? `:${port}`:''}`;
    return {origin, host, hostname, pathname, port, protocol, search, hash}
}

/*
 * Truncate string in the middle
 */
function truncate(fullStr, strLen, separator) {
    if (fullStr.length <= strLen) return fullStr;
    
    separator = separator || '...';
    
    var sepLen = separator.length,
        charsToShow = strLen - sepLen,
        frontChars = Math.ceil(charsToShow/2),
        backChars = Math.floor(charsToShow/2);
    
    return fullStr.substr(0, frontChars) + 
           separator + 
           fullStr.substr(fullStr.length - backChars);
};


/**
 * Attempt to find an RSS feed URL by providing a suffix
 */
function tryToGetFeedURL(tabUrl) {
    var url_datas = parseUrl(tabUrl);
    var feed = null;
    var isFound = false;

    var tests = ['/feed', '/rss', '/rss.xml', '/feed.xml'];

    for (var t = 0; t < tests.length; t++) {
        if (isFound === false) {
            var feed_url = url_datas.origin + tests[t];

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function(){
                if (xhr.readyState == 4 && xhr.status == 200) {
                    return xhr.responseText;
                }
            };
            xhr.open("GET", feed_url, false);
            xhr.send();

            var urlContent = xhr.responseText;
            if (xhr.status != 404 && urlContent != '')
            {
                var oParser = new DOMParser();
                var oDOM = oParser.parseFromString(urlContent, "application/xml");

                var getRssTag = oDOM.getElementsByTagName('rss');
                if (getRssTag.length > 0) {
                    var getChannelTag = getRssTag['0'].getElementsByTagName('channel')

                    if (getChannelTag.length > 0) {
                        isFound = true;

                        feed = {
                            type: '',
                            url: feed_url,
                            title: feed_url
                        };
                    }
                }
            }
        }
    }

    return feed;
}


document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        var url = tab.url;

        getFeedsURLs(url, function(feeds){

            if (feeds.length > 0)
            {
                var html = '<table id="feeds-list">';
                for (i = 0; i < feeds.length; i++) {
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
                        text += feeds_list[j]+"\n";
                    }
                    var textToCopy = text.substring(0, text.length - 1);
    
                    copyToClipboard(textToCopy, {type: "success", title: '', message: "Feeds URLs copied in clipboard!"});
                });
            }
            else
            {
                render("No feed found");
            }

        });
    });
});


