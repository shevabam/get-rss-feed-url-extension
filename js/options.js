const CACHE_PREFIX = 'getrss_cache_';

// Theme management (same pattern as popup.js)
function initTheme() {
    chrome.storage.sync.get(['theme'], function(result) {
        if (result.theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', function() {
        const isDark = document.body.classList.toggle('dark-theme');
        chrome.storage.sync.set({ theme: isDark ? 'dark' : 'light' });
    });
}

initTheme();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('review-link').href = `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
    initBadgeToggle();
    initClearCache();
    renderIgnoredSites();
});

function initBadgeToggle() {
    const checkbox = document.getElementById('show-badge');
    chrome.storage.sync.get(['showBadge'], function(result) {
        checkbox.checked = result.showBadge !== false;
    });
    checkbox.addEventListener('change', function() {
        chrome.storage.sync.set({ showBadge: this.checked });
    });
}

function initClearCache() {
    const btn = document.getElementById('clear-cache-btn');
    const btnText = btn.querySelector('.btn-text');

    btn.addEventListener('click', async function() {
        const allData = await chrome.storage.local.get(null);
        const keysToRemove = Object.keys(allData).filter(k => k.startsWith(CACHE_PREFIX));
        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
        }

        const originalText = btnText.textContent;
        btnText.textContent = 'Cleared!';
        btn.classList.add('success');

        setTimeout(() => {
            btnText.textContent = originalText;
            btn.classList.remove('success');
        }, 2000);
    });
}

function renderIgnoredSites() {
    const container = document.getElementById('ignored-sites-container');

    chrome.storage.sync.get(['ignoredSites'], function(result) {
        const sites = result.ignoredSites || [];
        container.innerHTML = '';

        if (sites.length === 0) {
            const p = document.createElement('p');
            p.className = 'empty-list-text';
            p.textContent = 'No ignored sites.';
            container.appendChild(p);
            return;
        }

        // "Remove All" button
        const clearAllRow = document.createElement('div');
        clearAllRow.className = 'clear-all-row';

        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'action-btn danger';
        clearAllBtn.textContent = 'Remove All';
        clearAllBtn.addEventListener('click', function() {
            chrome.storage.sync.set({ ignoredSites: [] }, renderIgnoredSites);
        });

        clearAllRow.appendChild(clearAllBtn);
        container.appendChild(clearAllRow);

        // Sites list
        const ul = document.createElement('ul');
        ul.className = 'sites-list';

        for (const site of sites) {
            const li = document.createElement('li');
            li.className = 'site-item';

            const span = document.createElement('span');
            span.className = 'site-name';
            span.textContent = site;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.title = 'Remove from ignored list';
            removeBtn.setAttribute('aria-label', `Remove ${site} from ignored list`);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.innerHTML = '<path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
            removeBtn.appendChild(svg);

            removeBtn.addEventListener('click', function() {
                chrome.storage.sync.get(['ignoredSites'], function(r) {
                    const updated = (r.ignoredSites || []).filter(s => s !== site);
                    chrome.storage.sync.set({ ignoredSites: updated }, renderIgnoredSites);
                });
            });

            li.appendChild(span);
            li.appendChild(removeBtn);
            ul.appendChild(li);
        }

        container.appendChild(ul);
    });
}
