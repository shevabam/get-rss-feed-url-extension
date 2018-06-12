
/**
 * Get RSS feeds URLs
 */
function getFeedsURLs(url, callback) {

    // Check if it's a Youtube URL (channel or user feed)
    var ytRss = getYoutubeRss(url);

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
                    if (feed_url.indexOf("//") == 0)
                        feed_url = "http:" + feed_url;
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
function getYoutubeRss(ytUrl)
{
    // Check if Youtube URL
    var regex = RegExp(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/gm);

    var isYTUrl = regex.test(ytUrl);
    
    if (isYTUrl)
    {
        // Remove after "?"
        ytUrl = ytUrl.split('?')[0];

        var channel = '';

        // https://www.youtube.com/channel/UCENv8pH4LkzvuSV_qHIcslg
        // https://www.youtube.com/user/cestpassorcierftv/featured
        if (ytUrl.split('channel/')[1])
        {
            channel = "channel_id=" + (ytUrl.split('channel/')[1]).split('/')[0]; 
        }
        else if (ytUrl.split('user/')[1])
        {
            channel = "user=" + (ytUrl.split('user/')[1]).split('/')[0];
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


/**
 * Prints message in #feeds
 */
function render(msg)
{
    document.getElementById('feeds').innerHTML = msg;
}



document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        var url = tab.url;

        getFeedsURLs(url, function(feeds){

            if (feeds.length > 0)
            {
                var html = "<ul>";
                for (i = 0; i < feeds.length; i++)
                {
                    html += "<li>";
                    html +=   '<a href="'+feeds[i].url+'" title="'+feeds[i].type+'" target="_blank">'+feeds[i].title+'</a>';
                    html += "</li>";
                }
                html += "</ul>";

                render(html);
            }
            else
            {
                render("No feed found");
            }

        });
    });
});



