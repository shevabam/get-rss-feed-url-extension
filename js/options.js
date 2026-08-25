// CACHE_PREFIX is defined in utilities.js (loaded before this script), shared with background.js

// Initialize theme on page load (shared logic in utilities.js)
initTheme();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('review-link').href = getReviewUrl();
    initBadgeToggle();
    initClearCache();
    initAddSite();
    renderIgnoredSites();
});

function initBadgeToggle() {
    const checkbox = document.getElementById('show-badge');
    chrome.storage.sync.get(['showBadge'], function(result) {
        checkbox.checked = result.showBadge !== false;
    });
    checkbox.addEventListener('change', function() {
        setSyncStorage({ showBadge: this.checked });
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

/**
 * Manually add a domain to the ignored list from the Options page (previously the list
 * could only be edited by using the popup's "Ignore this site" button on a specific tab).
 */
function initAddSite() {
    const input = document.getElementById('add-site-input');
    const btn = document.getElementById('add-site-btn');

    function addSite() {
        const raw = input.value.trim();
        if (!raw) return;

        // Accept a bare domain ("example.com") as well as a full URL.
        let hostname;
        try {
            hostname = new URL(raw.includes('://') ? raw : 'https://' + raw).hostname;
        } catch (e) {
            input.setCustomValidity('Enter a valid domain, e.g. example.com');
            input.reportValidity();
            return;
        }
        input.setCustomValidity('');
        hostname = normalizeHostname(hostname);

        chrome.storage.sync.get(['ignoredSites'], function(result) {
            const sites = result.ignoredSites || [];
            if (findIgnoredEntries(hostname, sites).length > 0) {
                // Already ignored (directly or via a parent domain) — nothing to do.
                input.value = '';
                return;
            }

            sites.push(hostname);
            setSyncStorage({ ignoredSites: sites }, function() {
                input.value = '';
                renderIgnoredSites();
            });
        });
    }

    btn.addEventListener('click', addSite);
    input.addEventListener('input', function() {
        input.setCustomValidity('');
    });
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSite();
        }
    });
}

function renderIgnoredSites() {
    const container = document.getElementById('ignored-sites-container');

    chrome.storage.sync.get(['ignoredSites'], function(result) {
        const sites = (result.ignoredSites || []).slice().sort((a, b) => a.localeCompare(b));
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
            const confirmed = confirm(
                sites.length === 1
                    ? 'Remove 1 site from the ignored list?'
                    : `Remove all ${sites.length} sites from the ignored list?`
            );
            if (!confirmed) return;
            setSyncStorage({ ignoredSites: [] }, renderIgnoredSites);
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
                    setSyncStorage({ ignoredSites: updated }, renderIgnoredSites);
                });
            });

            li.appendChild(span);
            li.appendChild(removeBtn);
            ul.appendChild(li);
        }

        container.appendChild(ul);
    });
}
