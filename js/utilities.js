

/**
 * Parse an URL to return host, protocol, ...
 */
function parseUrl(string) {
    const a = document.createElement('a'); 
    a.setAttribute('href', string);
    const {host, hostname, pathname, port, protocol, search, hash} = a;
    const origin = `${protocol}//${hostname}${port.length ? `:${port}`:''}`;
    return {origin, host, hostname, pathname, port, protocol, search, hash}
}

/**
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