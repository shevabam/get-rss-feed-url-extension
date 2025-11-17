

/**
 * Parse an URL to return host, protocol, ...
 */
function parseUrl(string) {
    return new URL(string);
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