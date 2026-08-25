
// Prefix used for feed-count cache entries in chrome.storage.local.
// Shared between background.js (writes/reads the cache) and options.js (clears it).
const CACHE_PREFIX = 'getrss_cache_';

/**
 * Parse an URL to return host, protocol, ...
 */
function parseUrl(string) {
    return new URL(string);
}

/**
 * Initialize theme (dark/light) from storage and wire up the toggle button.
 * Shared between popup.js and options.js.
 *
 * The CSS already defaults to the OS's `prefers-color-scheme` (see popup.css/options.css),
 * so when the user has never explicitly chosen a theme, the very first paint already matches
 * the system setting — no flash, and nothing to do here. `.dark-theme` / `.light-theme` are
 * only applied when the user has made an explicit choice, to override the OS default.
 */
function initTheme(toggleId = 'theme-toggle') {
    chrome.storage.sync.get(['theme'], function(result) {
        if (result.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else if (result.theme === 'light') {
            document.body.classList.add('light-theme');
        }
        // else: no explicit preference stored yet — the OS default set in CSS already applies.
    });

    // Setup theme toggle button
    const themeToggle = document.getElementById(toggleId);
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const prefersDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const isCurrentlyDark = document.body.classList.contains('dark-theme') ||
                (prefersDarkOS && !document.body.classList.contains('light-theme'));

            const goingDark = !isCurrentlyDark;
            document.body.classList.toggle('dark-theme', goingDark);
            document.body.classList.toggle('light-theme', !goingDark);

            // Save theme preference
            setSyncStorage({ theme: goingDark ? 'dark' : 'light' });
        });
    }
}

/**
 * Wrapper around chrome.storage.sync.set that surfaces quota/runtime errors
 * (e.g. QUOTA_BYTES_PER_ITEM exceeded) instead of failing silently.
 * `onSuccess` only runs if the write actually succeeded.
 */
function setSyncStorage(items, onSuccess) {
    chrome.storage.sync.set(items, function() {
        if (chrome.runtime.lastError) {
            console.error('chrome.storage.sync.set failed:', chrome.runtime.lastError.message);
            return;
        }
        if (onSuccess) onSuccess();
    });
}

/**
 * Normalize a hostname for the "ignored sites" feature: strip a leading "www." and lowercase
 * it, so "example.com" and "www.example.com" are always treated as the same site.
 * Shared between popup.js (ignore toggle), background.js (badge) and options.js (manual add).
 */
function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Every entry in `ignoredSites` that currently covers `hostname` — either an exact match
 * (after normalization) or a parent domain of it (e.g. an ignored "example.com" covers
 * "blog.example.com" and "m.example.com" too). Empty array if none match.
 */
function findIgnoredEntries(hostname, ignoredSites) {
    const target = normalizeHostname(hostname);
    return ignoredSites.filter(function(entry) {
        const normalizedEntry = normalizeHostname(entry);
        return target === normalizedEntry || target.endsWith('.' + normalizedEntry);
    });
}

/**
 * True if `hostname` is ignored — directly, or as a subdomain of an ignored entry.
 */
function isHostnameIgnored(hostname, ignoredSites) {
    return findIgnoredEntries(hostname, ignoredSites).length > 0;
}

/**
 * Normalize a `<link type="...">` value for comparison against FEED_TYPES: MIME types are
 * case-insensitive and may carry a "; charset=..." parameter, but the raw attribute value
 * previously wasn't normalized consistently between the service worker (countFeedsFromHtml,
 * lowercased only) and the popup (searchFeed, no normalization at all) — so the same page
 * could report a feed to one and not the other. Shared so both stay in sync.
 */
function normalizeFeedType(type) {
    return (type || '').trim().toLowerCase().split(';')[0].trim();
}

/**
 * Get the review URL for the current browser (Chrome or Edge)
 */
function getReviewUrl() {
    const id = chrome.runtime.id;
    const isEdge = navigator.userAgent.includes('Edg/');
    if (isEdge) {
        return `https://microsoftedge.microsoft.com/addons/detail/${id}`;
    }
    return `https://chromewebstore.google.com/detail/${id}/reviews`;
}

/**
 * Truncate string in the middle
 */
function truncate(fullStr, strLen, separator) {
    if (fullStr.length <= strLen) return fullStr;
    
    separator = separator || '...';
    
    let sepLen = separator.length,
        charsToShow = strLen - sepLen,
        frontChars = Math.ceil(charsToShow/2),
        backChars = Math.floor(charsToShow/2);
    
    return fullStr.substring(0, frontChars) +
        separator +
        fullStr.substring(fullStr.length - backChars);
};