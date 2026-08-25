
const IGNORED_PROTOCOLS = [
    "chrome:",
    "chrome-extension:",
    "about:",
    "vivaldi:",
    "edge:",
    "chrome-devtools:",
    "devtools:",
    "file:",
    "data:",
    "blob:",
    "view-source:",
    "ftp:"
];

const FEED_TYPES = [
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

const FEED_URL_SUFFIXES = [
    '/feed',
    '/feed/',
    '/rss',
    '/rss/',
    '/rss.xml',
    '/feed.xml',
    '/rss/news.xml',
    '/articles/feed',
    '/rss/index.html',
    '/blog/feed/',
    '/blog/feed.xml',
    '/blog/rss/',
    '/blog/rss.xml',
    '/feed/posts/default',
    // '/?format=feed',
    '/rss/featured'
];

// Default timeout for fetch requests (in milliseconds)
const FETCH_TIMEOUT = 5000;

// Use the browser's own User-Agent to avoid hardcoded version strings becoming outdated
const DEFAULT_USER_AGENT = navigator.userAgent;

/**
 * Fetch with timeout and default User-Agent.
 * Accepts an optional external `options.signal` (e.g. to cancel sibling suffix probes once one
 * succeeds) — it is composed with the timeout's own AbortController rather than overridden.
 */
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const externalSignal = options.signal;
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    // Add default User-Agent if not provided
    const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

/**
 * Get HTML source code from URL (returns Promise)
 */
async function fetchHtmlSource(url) {
    try {
        const response = await fetchWithTimeout(url, { method: 'get' });
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.warn(`Failed to fetch ${url}:`, error.message);
    }
    return null;
}

/**
 * Get HTML source code from URL (callback version for popup)
 */
function getHtmlSource(url, callback) {
    fetchHtmlSource(url)
        .then(function(data) {
            if (data) {
                callback(data);
            } else {
                renderMessage('Unable to find feed');
            }
        })
        .catch(function(error) {
            renderMessage('Error: ' + error.message);
        });
}

/**
 * Extacts link tag with some filters
 */
function extractLinkTags(html) {
    // let regex = /<link\s+[^>]*\btype=['"][^'"]+['"][^>]*>/gi;

    // Excludes link tags with:
    //   rel="stylesheet"
    //   rel="icon"
    //   rel="search"
    //   type="text/javascript"
    //   type="image/"
    //   type="font/"
    let regex = /<link\s+(?![^>]*\b(?:rel=['"](stylesheet|icon|search)['"]|type=['"](text\/javascript|image\/(.*)|font\/(.*))['"]))[^>]*\btype=['"][^'"]+['"][^>]*>/gi;

    let match = html.match(regex);

    return match || [];
}

/**
 * Check if content is a valid RSS/Atom feed (without DOMParser, for service worker)
 */
function isValidFeedContent(content) {
    // Check for RSS or Atom feed tags
    return /<rss[\s>]/i.test(content) || /<feed[\s>]/i.test(content);
}

/**
 * Test FEED_URL_SUFFIXES against `origin` with a bounded concurrency pool instead of firing
 * all of them at once (which multiplies the request volume sent to a single site by
 * FEED_URL_SUFFIXES.length on every cache miss). Suffixes are assigned to workers in priority
 * order; as soon as one probe succeeds, in-flight sibling requests are aborted.
 *
 * @param {string} origin
 * @param {(feedUrl: string, signal: AbortSignal) => Promise<any>} probe - resolves with a
 *   truthy result on a match, or with a falsy value / rejection otherwise.
 * @param {number} concurrency
 * @returns {Promise<any|null>}
 */
async function probeFeedSuffixes(origin, probe, concurrency = 3) {
    const controller = new AbortController();
    let nextIndex = 0;
    let result = null;

    async function worker() {
        while (result === null && nextIndex < FEED_URL_SUFFIXES.length) {
            const feedUrl = origin + FEED_URL_SUFFIXES[nextIndex++];
            try {
                const value = await probe(feedUrl, controller.signal);
                if (value && result === null) {
                    result = value;
                    controller.abort(); // cancel sibling requests still in flight
                }
            } catch (error) {
                // Try the next suffix
            }
        }
    }

    const workerCount = Math.min(concurrency, FEED_URL_SUFFIXES.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return result;
}

/**
 * Try to find a feed URL by testing common suffixes (for service worker).
 */
async function tryToFindFeedCount(url) {
    const origin = parseUrl(url).origin;
    if (!/^https?:\/\//i.test(origin)) return 0; // skip file:/data:/opaque origins etc.

    const found = await probeFeedSuffixes(origin, async (feedUrl, signal) => {
        const response = await fetchWithTimeout(feedUrl, { method: 'get', signal });
        if (!response.ok) return false;

        const content = await response.text();
        return isValidFeedContent(content);
    });

    return found ? 1 : 0;
}

/**
 * Count feeds in HTML without using DOM (for service worker)
 */
function countFeedsFromHtml(html) {
    const linkTags = extractLinkTags(html);
    const seenHrefs = new Set();
    let count = 0;

    for (const tag of linkTags) {
        const typeMatch = tag.match(/type=['"]([^'"]+)['"]/i);
        if (!typeMatch || !FEED_TYPES.includes(normalizeFeedType(typeMatch[1]))) continue;

        // Dedupe identical <link> tags (same raw href) so the badge count matches the popup's
        // deduped list, e.g. a page that emits the same feed link twice by mistake.
        const hrefMatch = tag.match(/href=['"]([^'"]*)['"]/i);
        const href = hrefMatch ? hrefMatch[1] : null;
        if (href) {
            if (seenHrefs.has(href)) continue;
            seenHrefs.add(href);
        }

        count++;
    }

    return count;
}


const SERVICES_TO_CHECK = [
    // 'Youtube', 
    'YoutubePlaylist',
    'RedditRoot', 
    'RedditSub', 
    'RedditUser', 
    'RedditPostComments',
    'Kickstarter', 
    'Vimeo', 
    'GithubRepo', 
    'GithubUser', 
    'GitlabRepo', 
    'GitlabUser', 
    'MediumTag',
    'Itchio',
    'MirrorXyz',
];

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

    if (IGNORED_PROTOCOLS.includes(parseUrl(url).protocol)) {
        // Always invoke the callback (even for ignored protocols) so callers relying on it
        // (e.g. popup.js's watchdog timers) don't wait indefinitely for a response.
        callback([]);
        return;
    }

    let getFeedUrl = checkIfUrlIsKnown(url);

    if (false !== getFeedUrl && getFeedUrl.length > 0) {
        callback(getFeedUrl);
    } else {
        getHtmlSource(url, (response) =>  {
            if (response != '') {
                let linkTags = extractLinkTags(response);
                // console.log(linkTags);

                document.getElementById('rss-feed-url_response').innerHTML = linkTags;
            }

            // searchFeed is async — make sure callback is still invoked if it throws
            // (e.g. an unexpected error), so callers waiting on it never hang.
            searchFeed(url, callback).catch(() => callback([]));
        });
    }
}

/**
 * Search RSS Feed in source code
 */
async function searchFeed(url, callback) {
    let feeds_urls = [];

    if (document.getElementById('rss-feed-url_response').innerHTML != '') {
        let links = document.getElementById('rss-feed-url_response').querySelectorAll("#rss-feed-url_response link[type]");

        document.getElementById('rss-feed-url_response').innerHTML = '';

        for (let i = 0; i < links.length; i++) {

            if (links[i].hasAttribute('type') && FEED_TYPES.includes(normalizeFeedType(links[i].getAttribute('type')))) {

                const href = links[i].getAttribute('href');
                if (!href) continue; // <link type="..."> with no href — nothing to resolve

                let feed_url;
                try {
                    // Let the platform resolve relative/protocol-relative/absolute URLs correctly
                    // (handles query strings, fragments, "../", trailing slashes, etc.)
                    feed_url = new URL(href, url).href;
                } catch (e) {
                    continue; // malformed href, skip this entry
                }

                let feed = {
                    type: links[i].getAttribute('type'),
                    url: feed_url,
                    title: links[i].getAttribute('title') || feed_url
                };

                feeds_urls.push(feed);
            }
        }
    
    }

    if (feeds_urls.length === 0) {

        let test_feed = await tryToGetFeedURL(url);

        if (test_feed !== null) {
            feeds_urls.push(test_feed);
        }
    }

    // A page can emit the same feed URL more than once (e.g. duplicate <link> tags) — dedupe
    // so the popup doesn't show/copy the same feed twice and the badge count stays accurate.
    const seenUrls = new Set();
    feeds_urls = feeds_urls.filter(function(feed) {
        if (seenUrls.has(feed.url)) return false;
        seenUrls.add(feed.url);
        return true;
    });

    callback(feeds_urls);
}



/**
 * Get "origin + pathname" from a URL, without its query string or fragment, and with any
 * trailing slash trimmed. Used by the service matchers below so a suffix like '.rss' is never
 * appended after a query string/fragment (which produces a non-existent feed URL).
 */
function getUrlBase(url) {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/+$/, '');
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
 * Get RSS feed URL of Youtube playist
 */
function getYoutubePlaylistRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/playlist\?list=(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;
        let query = '';
        let title = '';

        const playlist_id = new URL(url).searchParams.get('list');
        query = 'playlist_id=' + playlist_id;
        title = 'RSS Playlist';    

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
 * Get RSS feed URL for the Reddit homepage
 */
function getRedditRootRss(url) {
    let datas = { match: false, feeds: [] };


    let regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com(\/)?$/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        // Reddit's homepage feed is "/.rss" (note the leading dot), not just ".rss"
        const feed_url = getUrlBase(url) + '/.rss';
        datas.feeds.push({
            url: feed_url,
            title: feed_url
        });
    }

    return datas;
}

/**
 * Get RSS feed URL of a subreddit
 */
function getRedditSubRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        // getUrlBase() drops any query string/fragment (e.g. "?t=week", "#hot") so it never
        // ends up appended before ".rss", which would produce a non-existent feed URL.
        const feed_url = getUrlBase(url) + '.rss';
        datas.feeds.push({
            url: feed_url,
            title: feed_url
        });
    }

    return datas;
}

/**
 * Get RSS feed URL of a reddit user
 */
function getRedditUserRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/user\/(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        const feed_url = getUrlBase(url) + '.rss';
        datas.feeds.push({
            url: feed_url,
            title: feed_url
        });
    }

    return datas;
}

/**
 * Get RSS feed URL for reddit post comments
 */
function getRedditPostCommentsRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)\/comments\/(.+)\/(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        const feed_url = getUrlBase(url) + '.rss';
        datas.feeds.push({
            url: feed_url,
            title: feed_url
        });
    }

    return datas;
}


/**
 * Get RSS feed URL of kickstarter
 */
function getKickstarterRss(url) {
    let datas = { match: false, feeds: [] };

    // Require an actual project path (/projects/<creator>/<slug>) — matching the bare domain or
    // any other Kickstarter page (e.g. /discover/advanced) previously invented a phantom feed.
    let regex = /^(http(s)?:\/\/)?((w){3}.)?kickstarter\.com\/projects\/([^\/?#]+)\/([^\/?#]+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean); // ['projects', creator, slug, ...]
        const feed_url = u.origin + '/' + segments.slice(0, 3).join('/') + '/posts.atom';

        datas.feeds.push({
            url: feed_url,
            title: feed_url
        });
    }

    return datas;
}

// Vimeo site-wide pages that are not a username/channel — matching one of these as a single
// path segment previously invented a phantom "/videos/rss" feed (e.g. vimeo.com/log_in).
const VIMEO_RESERVED_PATHS = [
    'log_in', 'join', 'upload', 'upgrade', 'watch', 'search', 'settings',
    'features', 'about', 'help', 'stats', 'subscriptions', 'manage', 'create',
    'pricing', 'blog', 'developer', 'enterprise'
];

/**
 * Get RSS feed URL of vimeo
 */
function getVimeoRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?vimeo\.com\/([a-zA-Z](.+))(\/videos)?/i;
    let has_match = regex.test(url);

    if (has_match) {
        const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
        const firstSegment = (pathSegments[0] || '').toLowerCase();
        const isSingleReservedPage = pathSegments.length === 1 && VIMEO_RESERVED_PATHS.includes(firstSegment);

        if (!isSingleReservedPage) {
            datas.match = true;

            const base = getUrlBase(url).replace(/\/videos$/i, '');
            const feed_url = base + '/videos/rss';

            datas.feeds.push({
                url: feed_url,
                title: feed_url
            });
        }
    }

    return datas;
}

// GitHub top-level paths that are site pages, not usernames — matching one of these previously
// invented phantom repo/user feeds (e.g. github.com/settings/profile -> 3 fabricated feeds).
const GITHUB_RESERVED_PATHS = [
    'settings', 'orgs', 'features', 'sponsors', 'marketplace', 'topics',
    'collections', 'apps', 'notifications', 'pulls', 'issues', 'dashboard',
    'explore', 'trending', 'watching', 'stars', 'new', 'login', 'join',
    'about', 'pricing', 'contact', 'security', 'site', 'support', 'search'
];

/**
 * Get RSS feed URL of Github repo
 */
function getGithubRepoRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?github\.com\/([a-zA-Z0-9](.+))\/([a-zA-Z0-9](.+))$/i;
    let matches = url.match(regex);

    if (matches) {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean); // ['user', 'repo', ...]

        if (segments.length >= 2 && !GITHUB_RESERVED_PATHS.includes(segments[0].toLowerCase())) {
            datas.match = true;
            const baseRepoUrl = u.origin + '/' + segments.slice(0, 2).join('/');

            datas.feeds.push({ url: baseRepoUrl + '/releases.atom', title: 'Repo releases' });
            datas.feeds.push({ url: baseRepoUrl + '/commits.atom', title: 'Repo commits' });
            datas.feeds.push({ url: baseRepoUrl + '/tags.atom', title: 'Repo tags' });
        }
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
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean);

        if (segments.length === 1 && !GITHUB_RESERVED_PATHS.includes(segments[0].toLowerCase())) {
            datas.match = true;
            const userUrl = u.origin + '/' + segments[0];
            datas.feeds.push({ url: userUrl + '.atom', title: 'User activity' });
        }
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
 * Get RSS feed URL of a medium tag page
 */
function getMediumTagRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?medium\.com\/tag\/(.+)/i;
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        let tag = url.match(regex)[5];

        let feed_url = url.replace(/(\/tag)/, '/feed$1');

        if (feed_url) {
            datas.feeds.push({
                url: feed_url,
                title: tag ?? feed_url
            });
        }
    }

    return datas;
}

/**
 * Get RSS feed URL of a itch.io page
 */
function getItchioRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^(http(s)?:\/\/)?((w){3}.)?itch\.io\/(.+)/i;
    let matches = url.match(regex);
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        let feed_url = url + '.xml';

        datas.feeds.push({
            url: feed_url,
            title: matches[5] ?? feed_url
        });
    }

    return datas;
}

/**
 * Get RSS feed URL of a mirro.xyz
 */
function getMirrorXyzRss(url) {
    let datas = { match: false, feeds: [] };

    let regex = /^https?:\/\/([a-zA-Z0-9-]+)\.mirror\.xyz\/[a-zA-Z0-9_-]+$/;
    let matches = url.match(regex);
    let has_match = regex.test(url);

    if (has_match) {
        datas.match = true;

        const urlObj = new URL(url);
        const baseUrl = urlObj.origin;
        const subdomain = matches[1];

        let feed_url = baseUrl + '/feed/atom';

        datas.feeds.push({
            url: feed_url,
            title: subdomain
        });
    }

    return datas;
}



/**
 * Prints trusted, internally-generated HTML markup in #feeds.
 * Never pass user/network-controlled text to this function — use renderMessage() instead.
 */
function render(html) {
    document.getElementById('feeds').innerHTML = html;
}

/**
 * Prints a plain-text status message in #feeds (empty state style), safely escaped via
 * textContent — no innerHTML involved, so the text can never be interpreted as markup.
 */
function renderMessage(text) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'empty-state-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    icon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/>';

    const title = document.createElement('div');
    title.className = 'empty-state-title';
    title.textContent = text;

    const container = document.createElement('div');
    container.className = 'empty-state';
    container.appendChild(icon);
    container.appendChild(title);

    document.getElementById('feeds').replaceChildren(container);
}

/**
 * Copy to clipboard text
 */
async function copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
}


/**
 * Attempt to find an RSS feed URL by providing a suffix (popup fallback).
 * Uses the same bounded concurrency pool as tryToFindFeedCount() — see probeFeedSuffixes().
 */
async function tryToGetFeedURL(tabUrl) {
    const origin = parseUrl(tabUrl).origin;
    if (!/^https?:\/\//i.test(origin)) return null; // skip file:/data:/opaque origins etc.

    return await probeFeedSuffixes(origin, async (feed_url, signal) => {
        const response = await fetchWithTimeout(feed_url, { method: 'get', signal });

        if (!response.ok || response.status < 200 || response.status >= 300) {
            return null;
        }

        const urlContent = await response.text();
        const oParser = new DOMParser();
        const oDOM = oParser.parseFromString(urlContent, "application/xml");

        const hasRssTag = oDOM.getElementsByTagName('rss').length > 0;
        const hasFeedTag = oDOM.getElementsByTagName('feed').length > 0;

        if (!hasRssTag && !hasFeedTag) return null;

        return { type: '', url: feed_url, title: feed_url };
    });
}