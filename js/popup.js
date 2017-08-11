
/**
 * Get RSS feeds URLs
 */
function getFeedsURLs(url, callback) {
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



