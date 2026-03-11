

/**
 * Parse an URL to return host, protocol, ...
 */
function parseUrl(string) {
    return new URL(string);
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