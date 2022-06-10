
/**
 * Do XHR GET Request
 */
function getJSON(url, callback) {

    var token = _CONFIG_.api_token;
    fetch(url, {
           method: 'get', 
           headers: new Headers({
             'Content-Type': 'application/json',
             'Authorization': 'Bearer ' + token
           })
         })
        .then(function(response){
            if (response.status == 200) {
                response.json().then(function(data){
                callback(data);
            })
            }
            else {
                render('Unable to find feed');
            }
        })
        .catch(function(error){
            render('Error: '+error.message);
        });
}

/**
 * Fetch feeds
 */
function getFeedsURLs(url, callback) {

    if (typeof _CONFIG_ != 'undefined' && _CONFIG_.api_token != '' && _CONFIG_.api_url != '') {

        if (url != 'undefined' && typeof url != 'undefined') {

            var params = {'from': 'extension_get-rss-feed-url'};

            var feeds_founded = false;

            _CONFIG_.api_url.forEach(api_url => {
                
                if (feeds_founded === false) {

                    getJSON(api_url+'fetch.php?url='+url+'&params='+JSON.stringify(params), (response) =>  {

                        // console.log('API host : '+api_url);
                        // console.log(response);
                        var feeds_urls = [];

                        if (response != null && response.datas.feeds.length > 0) {

                            feeds_founded = true;

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

                            callback(feeds_urls);

                        }

                    });

                }

            });

        }
    }
    else {
        render('Unable to find feed');
    }
}



/**
 * Prints message in #feeds
 */
function render(content) {
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

