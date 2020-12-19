
/**
 * Do XHR GET Request
 */
function getJSON(url, callback) {

    var token = _CONFIG_.api_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.responseType = 'json';

    xhr.onload = function() {

        var status = xhr.status;

        if (status == 200) {
            callback(xhr.response);
        } else {
            render('Unable to find feed');
        }
    }

    xhr.send();
}

/**
 * Fetch feeds
 */
function getFeedsURLs(url, callback) {
    if (url != 'undefined' && typeof url != 'undefined' && _CONFIG_.api_token != '') {
        var params = {'from': 'extension_get-rss-feed-url'};

        getJSON('https://get-rss-url-api.shevapps.fr/fetch.php?url='+url+'&params='+JSON.stringify(params), (response) =>  {

            var feeds_urls = [];

            if (response != null) {

                for (var i = 0; i < response.datas.feeds.length; i++){
                    var obj = response.datas.feeds[i];

                    var feed_url = obj['url'];
                    var feed_title = obj['title'];

                    var feed = {
                        url: feed_url,
                        title: feed_title || feed_url
                    };

                    feeds_urls.push(feed);
                }
            }

            callback(feeds_urls);
        });
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
        title: notification.title || "Get RSS Feeds URLs",
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

