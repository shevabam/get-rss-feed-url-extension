



/**
 * Get HTML source code froms URL
 */
function getHtmlSource(url, callback) {
    fetch(url, {
        method: 'get'
      })
    .then(function(response){
        if (response.status == 200) {
            response.text().then(function(data){
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


const SERVICES_TO_CHECK = [/*'Youtube',*/ 'Reddit', 'Kickstarter', 'Vimeo', 'GithubRepo', 'GithubUser', 'GitlabRepo', 'GitlabUser'];

function checkIfUrlIsKnown(url) {
    let match = false;
    let check = {};

    for (const service of SERVICES_TO_CHECK) {
        const method = 'get' + service + 'Rss';
        check = this[method](url);

        match = check.match;

        if (match === true) {
            break;
        }
    }

    if (match === true) {
        return check.feeds;
    } else {
        return false;
    }
}


/**
 * Get RSS feeds URLs
 */
function getFeedsURLs(url, callback) {
    var getFeedUrl = checkIfUrlIsKnown(url);

    if (false !== getFeedUrl && getFeedUrl.length > 0) {
        callback(getFeedUrl);
    } else {
        getHtmlSource(url, (response) =>  {
            if (response != '') {
                document.getElementById('rss-feed-url_response').innerHTML = response;
            }

            searchFeed(url, callback);
        });
    }
}

/**
 * Search RSS Feed in source code
 */
function searchFeed(url, callback) {
    if (document.getElementById('rss-feed-url_response').innerHTML != '') {
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

        var links = document.getElementById('rss-feed-url_response').querySelectorAll("#rss-feed-url_response link[type]");

        document.getElementById('rss-feed-url_response').innerHTML = '';

        for (var i = 0; i < links.length; i++) {

            if (links[i].hasAttribute('type') && types.indexOf(links[i].getAttribute('type')) !== -1) {

                var feed_url = links[i].getAttribute('href');

                // If feed's url starts with "//"
                if (feed_url.startsWith('//')) {
                    feed_url = "http:" + feed_url;
                }
                // If feed's url starts with "/"
                else if (feed_url.startsWith('/')) {
                    feed_url = url.split('/')[0] + '//' + url.split('/')[2] + feed_url;
                }
                // If feed's url starts with http or https
                else if (/^(http|https):\/\//i.test(feed_url)) {
                    feed_url = feed_url;
                }
                // If feed's has no slash
                else if (!feed_url.match(/\//)) {
                    feed_url = url.substr(0, url.lastIndexOf("/")) + '/' + feed_url;
                }
                else {
                    feed_url = url + "/" + feed_url.replace(/^\//g, '');
                }

                var feed = {
                    type: links[i].getAttribute('type'),
                    url: feed_url,
                    title: links[i].getAttribute('title') || feed_url
                };

                feeds_urls.push(feed);
            }
        }

        if (feeds_urls.length === 0) {

            var test_feed = tryToGetFeedURL(url);

            if (test_feed !== null) {
                feeds_urls.push(test_feed);
            }
        }

        callback(feeds_urls);
    
    } else {
        render('Unable to find feed');
    }
}



/**
 * Get RSS feed URL of Youtube channel or user
 */
function getYoutubeRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/(channel|user|c).+/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;
        let query = '';
        let title = '';

        let path = new URL(url).pathname;

        if (path.startsWith('/channel/')) {
            let channel_id = path.substr('/channel/'.length).split('/')[0];
            query = 'channel_id=' + channel_id;
            title = channel_id;
        } else if (path.startsWith('/c/')) {
            let channel_id = path.substr('/c/'.length).split('/')[0];
            query = 'user=' + channel_id;
            title = channel_id;
        } else if (path.startsWith('/user/')) {
            let user_id = path.substr('/user/'.length).split('/')[0];
            query = 'user=' + user_id;
            title = user_id;
        }

        if (query != '') {
            datas.feeds.push({
                url: 'https://www.youtube.com/feeds/videos.xml?' + query,
                title: title
            });
        }
    }

    return datas;
}


/**
 * Get RSS feed URL of a subreddit
 */
function getRedditRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        let feed_url = url.endsWith('/') ? url.slice(0, -1) : url;
        feed_url += '.rss';

        if (feed_url) {
            datas.feeds.push({
                url: feed_url,
                title: feed_url
            });
        }
    }

    return datas;
}


/**
 * Get RSS feed URL of kickstarter
 */
function getKickstarterRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?kickstarter\.com/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        let feed_url = url.endsWith('/') ? url.slice(0, -1) : url;
        feed_url = feed_url.split('?')[0] + '/posts.atom';

        if (feed_url) {
            datas.feeds.push({
                url: feed_url,
                title: feed_url
            });
        }
    }

    return datas;
}

/**
 * Get RSS feed URL of vimeo
 */
function getVimeoRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?vimeo\.com\/([a-zA-Z](.+))(\/videos)?/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        let feed_url = url.endsWith('/videos') ? url.replace(/\/videos$/, '') + '/rss' : url + '/videos/rss';

        if (feed_url) {
            datas.feeds.push({
                url: feed_url,
                title: feed_url
            });
        }
    }

    return datas;
}

/**
 * Get RSS feed URL of Github repo
 */
function getGithubRepoRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?github\.com\/([a-zA-Z0-9](.+))\/([a-zA-Z0-9](.+))$/i;
    let matches = url.match(regex);

    if (matches) {
        datas.match = true;
        let repoUrl = matches[0].replace(/\/$/, ''); // Remove trailing slash

        datas.feeds.push({ url: repoUrl + '/releases.atom', title: 'Repo releases' });
        datas.feeds.push({ url: repoUrl + '/commits.atom', title: 'Repo commits' });
        datas.feeds.push({ url: repoUrl + '/tags.atom', title: 'Repo tags' });
    }

    return datas;
}

/*
 * Get RSS feed URL of Github user
 */
function getGithubUserRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?github\.com\/([a-zA-Z0-9](.+))$/i;
    let matches = url.match(regex);

    if (matches) {
        datas.match = true;
        let userUrl = matches[0].replace(/\/$/, ''); // Remove trailing slash
        datas.feeds.push({ url: userUrl + '.atom', title: 'User activity' });
    }

    return datas;
}

/**
 * Get RSS feed URL of Gitlab repo
 */
function getGitlabRepoRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?gitlab\.com\/([a-zA-Z0-9](.+))\/([a-zA-Z0-9](.+))$/i;
    let matches = url.match(regex);

    if (matches) {
        datas.match = true;
        let repoUrl = matches[0].replace(/\/$/, ''); // Remove trailing slash

        datas.feeds.push({ url: repoUrl + '.atom', title: 'Repo commits' });
    }

    return datas;
}

/*
 * Get RSS feed URL of Gitlab user
 */
function getGitlabUserRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?gitlab\.com\/([a-zA-Z0-9](.+))$/i;
    let matches = url.match(regex);

    if (matches) {
        datas.match = true;
        let userUrl = matches[0].replace(/\/$/, ''); // Remove trailing slash
        datas.feeds.push({ url: userUrl + '.atom', title: 'User activity' });
    }

    return datas;
}

/**
 * Prints message in #feeds
 */
function render(content) {
    document.getElementById('feeds').innerHTML = content;
}

/**
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



/**
 * Attempt to find an RSS feed URL by providing a suffix
 */
function tryToGetFeedURL(tabUrl) {
    var url_datas = parseUrl(tabUrl);
    var feed = null;
    var isFound = false;

    var tests = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/rss/news.xml', '/articles/feed', '/rss/index.html'];

    for (var t = 0; t < tests.length; t++) {
        if (isFound === false) {
            var feed_url = url_datas.origin + tests[t];

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function(){
                if (xhr.readyState == XMLHttpRequest.DONE) {
                    return xhr.responseText;
                }
            };
            xhr.open("GET", feed_url, false);
            xhr.send();

            var urlContent = xhr.responseText;

            if (xhr.status >= 200 && xhr.status < 400 && urlContent != '')
            {
                var oParser = new DOMParser();
                var oDOM = oParser.parseFromString(urlContent, "application/xml");

                var getRssTag = oDOM.getElementsByTagName('rss');
                var getFeedTag = oDOM.getElementsByTagName('feed');

                if (getRssTag.length > 0 || getFeedTag.length > 0) {

                    if (getRssTag.length > 0) {
                        var getChannelTag = getRssTag['0'].getElementsByTagName('channel');
                    } else if (getFeedTag.length > 0) {
                        var getChannelTag = getFeedTag['0'];
                    }

                    // if (getChannelTag.length > 0) {
                    if (getChannelTag !== false) {
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