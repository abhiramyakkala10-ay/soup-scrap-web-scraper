// Global State to hold scraped data for filtering and exports
let SCRAPED_DATA = null;

// DOM Elements
const scraperForm = document.getElementById('scraper-form');
const targetUrlInput = document.getElementById('target-url');
const userAgentSelect = document.getElementById('user-agent');
const customSelectorInput = document.getElementById('custom-selector');
const scrapeBtn = document.getElementById('scrape-btn');
const btnSpinner = document.getElementById('btn-spinner');
const logTerminal = document.getElementById('log-terminal');
const clearLogsBtn = document.getElementById('clear-logs');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Results elements
const resultsSection = document.getElementById('results-section');
const scrapedUrlBadge = document.getElementById('scraped-url-badge');
const countLinks = document.getElementById('count-links');
const countImages = document.getElementById('count-images');
const countTables = document.getElementById('count-tables');
const countSelector = document.getElementById('count-selector');
const tabBtnSelector = document.getElementById('tab-btn-selector');

// Overview Tab Elements
const statLinks = document.getElementById('stat-links');
const statImages = document.getElementById('stat-images');
const statTables = document.getElementById('stat-tables');
const statHeadings = document.getElementById('stat-headings');
const pageTitleVal = document.getElementById('page-title-val');
const pageStatusVal = document.getElementById('page-status-val');
const metaTagsList = document.getElementById('meta-tags-list');
const headingsStructure = document.getElementById('headings-structure');

// Links Tab Elements
const linksTbody = document.getElementById('links-tbody');
const linksSearch = document.getElementById('links-search');
const downloadLinksCsv = document.getElementById('download-links-csv');

// Images Tab Elements
const imagesGrid = document.getElementById('images-grid');
const imagesSearch = document.getElementById('images-search');
const downloadImagesCsv = document.getElementById('download-images-csv');

// Tables Tab Elements
const tableDropdown = document.getElementById('table-dropdown');
const tablesSelectorContainer = document.getElementById('tables-selector-container');
const tableViewEmpty = document.getElementById('table-view-empty');
const tableWrapperResults = document.getElementById('table-wrapper-results');
const scrapedTableHead = document.getElementById('scraped-table-head');
const scrapedTableBody = document.getElementById('scraped-table-body');
const downloadTableCsv = document.getElementById('download-table-csv');

// Selector Tab Elements
const selectorTargetCode = document.getElementById('selector-target-code');
const selectorCountBadge = document.getElementById('selector-count-badge');
const selectorMatchesContainer = document.getElementById('selector-matches-container');
const downloadSelectorCsv = document.getElementById('download-selector-csv');

// Raw HTML Tab Elements
const rawHtmlCode = document.getElementById('raw-html-code');
const copyHtmlBtn = document.getElementById('copy-html-btn');

// Export Main Buttons
const exportJsonBtn = document.getElementById('export-json');
const exportCsvBtn = document.getElementById('export-csv');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Core Logging Engine
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${timestamp}]`;
    
    const msgText = document.createTextNode(message);
    
    line.appendChild(timeSpan);
    line.appendChild(msgText);
    
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Clear Terminal
clearLogsBtn.addEventListener('click', () => {
    logTerminal.innerHTML = '';
    log('Activity log cleared.', 'system');
});

// Show Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-msg">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Check Backend Connection Status
async function checkApiConnection() {
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'http://check-connection-dummy.local', target: 'test' })
        });
        // Even if we get an unprocessable entity (422) or something similar, it means the API is reachable
        updateApiStatus(true);
    } catch (e) {
        // Only mark offline if network failed completely (e.g. server not running)
        updateApiStatus(false);
    }
}

function updateApiStatus(isOnline) {
    if (isOnline) {
        statusIndicator.className = 'status-dot online';
        statusText.textContent = 'Connected to API';
    } else {
        statusIndicator.className = 'status-dot offline';
        statusText.textContent = 'Offline (Start API Server)';
        log('Warning: Backend API seems unreachable. Start main.py to connect.', 'error');
    }
}

// Initialize status check
checkApiConnection();
setInterval(checkApiConnection, 10000); // Check status every 10s

// Form Submission Event
scraperForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = targetUrlInput.value.trim();
    const userAgent = userAgentSelect.value;
    const selector = customSelectorInput.value.trim();
    
    if (!url) return;
    
    // Set UI State Loading
    scrapeBtn.disabled = true;
    btnSpinner.classList.remove('hidden');
    log(`Initializing request for URL: "${url}"`, 'system');
    log(`Selected Browser User-Agent profile: "${userAgent}"`, 'info');
    if (selector) {
        log(`Applying custom CSS selector search: "${selector}"`, 'info');
    }
    
    log(`Fetching remote page HTML content...`, 'info');
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                target: 'all',
                selector: selector || null,
                user_agent: userAgent
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'An unknown server error occurred');
        }
        
        log(`HTTP Connection Established (Status ${data.status_code})`, 'success');
        log(`Parsing DOM tree structure via Beautiful Soup...`, 'info');
        
        // Save global data
        SCRAPED_DATA = data;
        
        // Log Scraping Summaries
        log(`Title: "${data.title}"`, 'success');
        log(`Scraped Components Checklist:`, 'system');
        log(`- Found ${data.summary.links_count} anchor links`, 'success');
        log(`- Found ${data.summary.images_count} images`, 'success');
        log(`- Found ${data.summary.tables_count} data tables`, 'success');
        log(`- Found ${data.summary.headings_count} headings`, 'success');
        
        if (selector) {
            if (data.custom_selector && !data.custom_selector.error) {
                log(`- Custom selector "${selector}" yielded ${data.custom_selector.count} matches`, 'success');
            } else if (data.custom_selector && data.custom_selector.error) {
                log(`- Custom selector error: ${data.custom_selector.error}`, 'error');
            }
        }
        
        // Populate dashboard components
        populateDashboard(data);
        
        // Reveal results container
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        showToast('Page scraped successfully!', 'success');
        
    } catch (error) {
        log(`Scraping Failed: ${error.message}`, 'error');
        showToast(error.message, 'error');
    } finally {
        scrapeBtn.disabled = false;
        btnSpinner.classList.add('hidden');
    }
});

// Tab Navigation Logic
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Remove active class from buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        // Add active to current
        button.classList.add('active');
        
        // Toggle panes
        tabPanes.forEach(pane => {
            if (pane.id === targetTab) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    });
});

// Populates all parts of the dashboard with API response data
function populateDashboard(data) {
    // 1. Update Head Counts Badges
    scrapedUrlBadge.textContent = data.url;
    scrapedUrlBadge.title = data.url;
    countLinks.textContent = data.summary.links_count;
    countImages.textContent = data.summary.images_count;
    countTables.textContent = data.summary.tables_count;
    
    // Toggle CSS custom selector tab based on availability
    if (data.custom_selector && data.custom_selector.selector) {
        tabBtnSelector.classList.remove('hidden');
        countSelector.textContent = data.custom_selector.count;
    } else {
        tabBtnSelector.classList.add('hidden');
    }
    
    // 2. Populate OVERVIEW
    statLinks.textContent = data.summary.links_count;
    statImages.textContent = data.summary.images_count;
    statTables.textContent = data.summary.tables_count;
    statHeadings.textContent = data.summary.headings_count;
    
    pageTitleVal.textContent = data.title;
    pageStatusVal.textContent = `${data.status_code} OK`;
    
    // Metadata tags rendering
    metaTagsList.innerHTML = '';
    const metaKeys = Object.keys(data.meta);
    if (metaKeys.length === 0) {
        metaTagsList.innerHTML = '<div class="text-muted">No meta tag descriptions or properties found on this page.</div>';
    } else {
        metaKeys.forEach(key => {
            const row = document.createElement('div');
            row.className = 'meta-row';
            row.innerHTML = `
                <span class="meta-key">${escapeHtml(key)}</span>
                <span class="meta-val">${escapeHtml(data.meta[key])}</span>
            `;
            metaTagsList.appendChild(row);
        });
    }
    
    // Heading hierarchy rendering
    headingsStructure.innerHTML = '';
    let headingsFound = false;
    for (let level = 1; level <= 6; level++) {
        const tag = `h${level}`;
        if (data.headings[tag] && data.headings[tag].length > 0) {
            headingsFound = true;
            data.headings[tag].forEach(text => {
                const item = document.createElement('div');
                item.className = 'heading-item';
                item.innerHTML = `
                    <span class="heading-tag ${tag}">${tag.toUpperCase()}</span>
                    <span class="heading-text">${escapeHtml(text)}</span>
                `;
                headingsStructure.appendChild(item);
            });
        }
    }
    if (!headingsFound) {
        headingsStructure.innerHTML = '<div class="tab-empty"><i class="fa-solid fa-heading"></i><p>No headings structure (H1-H6) discovered.</p></div>';
    }
    
    // 3. Populate LINKS
    renderLinksTable(data.links);
    
    // 4. Populate IMAGES
    renderImagesGrid(data.images);
    
    // 5. Populate TABLES
    populateTablesDropdown(data.tables);
    
    // 6. Populate CUSTOM CSS
    if (data.custom_selector && data.custom_selector.selector) {
        selectorTargetCode.textContent = data.custom_selector.selector;
        selectorCountBadge.textContent = `${data.custom_selector.count} matches`;
        
        selectorMatchesContainer.innerHTML = '';
        if (data.custom_selector.count === 0) {
            selectorMatchesContainer.innerHTML = '<div class="tab-empty"><i class="fa-solid fa-magnifying-glass"></i><p>No elements matched the CSS Selector.</p></div>';
        } else {
            data.custom_selector.matches.forEach((match, index) => {
                const card = document.createElement('div');
                card.className = 'selector-match-card';
                
                // Form attributes snippet
                let attrSnippet = '';
                const attrs = Object.keys(match.attributes);
                if (attrs.length > 0) {
                    attrSnippet = '<div class="match-html-label">Attributes</div><div style="font-size:0.8rem; margin-bottom:0.5rem; color:#cbd5e1; font-family:var(--font-mono)">';
                    attrs.forEach(k => {
                        attrSnippet += `<span>${k}="${match.attributes[k]}"</span> `;
                    });
                    attrSnippet += '</div>';
                }
                
                card.innerHTML = `
                    <div class="match-header">
                        <span class="match-tag">&lt;${match.tag}&gt;</span>
                        <span class="match-index">Match #${index + 1}</span>
                    </div>
                    <div class="match-text"><strong>Inner Text:</strong> ${match.text ? escapeHtml(match.text) : '<span class="text-muted">Empty string</span>'}</div>
                    ${attrSnippet}
                    <div class="match-html-label">Outer HTML Markup</div>
                    <pre class="match-html-block"><code>${escapeHtml(match.outer_html)}</code></pre>
                `;
                selectorMatchesContainer.appendChild(card);
            });
        }
    }
    
    // 7. Populate RAW HTML
    rawHtmlCode.textContent = data.raw_html;
}

// Render Links
function renderLinksTable(links, filterText = '') {
    linksTbody.innerHTML = '';
    const cleanSearch = filterText.toLowerCase().trim();
    
    const filtered = links.filter(link => {
        return link.text.toLowerCase().includes(cleanSearch) || 
               link.href.toLowerCase().includes(cleanSearch);
    });
    
    if (filtered.length === 0) {
        linksTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No matching links found.</td></tr>`;
        return;
    }
    
    filtered.forEach(link => {
        const tr = document.createElement('tr');
        const badgeClass = link.is_external ? 'external' : 'internal';
        const badgeLabel = link.is_external ? 'External' : 'Internal';
        
        tr.innerHTML = `
            <td><strong>${escapeHtml(link.text)}</strong></td>
            <td><a href="${link.href}" target="_blank" class="table-link">${escapeHtml(link.href)}</a></td>
            <td><span class="link-badge ${badgeClass}">${badgeLabel}</span></td>
            <td>
                <button class="btn btn-sm btn-outline copy-link-btn" data-url="${link.href}">
                    <i class="fa-solid fa-copy"></i>
                </button>
            </td>
        `;
        
        // Attach copy trigger
        tr.querySelector('.copy-link-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            navigator.clipboard.writeText(btn.getAttribute('data-url'));
            btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--color-success)"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 1500);
            showToast('Link copied to clipboard', 'success');
        });
        
        linksTbody.appendChild(tr);
    });
}

// Render Images
function renderImagesGrid(images, filterText = '') {
    imagesGrid.innerHTML = '';
    const cleanSearch = filterText.toLowerCase().trim();
    
    const filtered = images.filter(img => {
        return img.alt.toLowerCase().includes(cleanSearch) || 
               img.src.toLowerCase().includes(cleanSearch);
    });
    
    if (filtered.length === 0) {
        imagesGrid.innerHTML = '<div style="grid-column:1/-1;" class="tab-empty"><i class="fa-solid fa-image"></i><p>No matching images discovered.</p></div>';
        return;
    }
    
    filtered.forEach(img => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.innerHTML = `
            <div class="image-preview-box">
                <!-- If image fails to load, draw placeholder box -->
                <img src="${img.src}" alt="${escapeHtml(img.alt)}" onerror="this.src='https://placehold.co/300x200?text=Preview+Blocked';">
            </div>
            <div class="image-details-box">
                <span class="image-alt" title="${escapeHtml(img.alt)}">${escapeHtml(img.alt)}</span>
                <a href="${img.src}" target="_blank" class="image-url-link" title="${escapeHtml(img.src)}">${escapeHtml(img.src)}</a>
                <div class="image-actions">
                    <button class="btn btn-sm btn-outline copy-img-btn" style="flex:1" data-url="${img.src}"><i class="fa-solid fa-copy"></i> Copy</button>
                    <a href="${img.src}" target="_blank" class="btn btn-sm btn-outline" style="flex:1; text-decoration:none;"><i class="fa-solid fa-up-right-from-square"></i> Visit</a>
                </div>
            </div>
        `;
        
        card.querySelector('.copy-img-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            navigator.clipboard.writeText(btn.getAttribute('data-url'));
            btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--color-success)"></i> OK';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 1500);
            showToast('Image URL copied to clipboard', 'success');
        });
        
        imagesGrid.appendChild(card);
    });
}

// Populate tables selection dropdown
function populateTablesDropdown(tables) {
    tableDropdown.innerHTML = '';
    
    if (tables.length === 0) {
        tablesSelectorContainer.classList.add('hidden');
        tableViewEmpty.classList.remove('hidden');
        tableWrapperResults.classList.add('hidden');
        return;
    }
    
    tablesSelectorContainer.classList.remove('hidden');
    tableViewEmpty.classList.add('hidden');
    tableWrapperResults.classList.remove('hidden');
    
    tables.forEach(tbl => {
        const opt = document.createElement('option');
        opt.value = tbl.id;
        opt.textContent = `Table #${tbl.id} (${tbl.headers.length} columns, ${tbl.rows.length} rows)`;
        tableDropdown.appendChild(opt);
    });
    
    // Initialize view of first table
    renderScrapedTable(tables[0]);
}

// Render dynamic table rows
function renderScrapedTable(table) {
    scrapedTableHead.innerHTML = '';
    scrapedTableBody.innerHTML = '';
    
    // Headers
    const trHead = document.createElement('tr');
    table.headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
    });
    scrapedTableHead.appendChild(trHead);
    
    // Data Rows
    if (table.rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${table.headers.length}" style="text-align:center; color:var(--text-muted)">This table is empty.</td>`;
        scrapedTableBody.appendChild(tr);
        return;
    }
    
    table.rows.forEach(cells => {
        const tr = document.createElement('tr');
        cells.forEach(c => {
            const td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
        });
        // Pad row if cols are fewer than header count
        while (tr.children.length < table.headers.length) {
            const td = document.createElement('td');
            td.textContent = '';
            tr.appendChild(td);
        }
        scrapedTableBody.appendChild(tr);
    });
}

// Table dropdown change trigger
tableDropdown.addEventListener('change', () => {
    const selectedId = parseInt(tableDropdown.value);
    const table = SCRAPED_DATA.tables.find(t => t.id === selectedId);
    if (table) {
        renderScrapedTable(table);
    }
});

// Search Filter Input triggers
linksSearch.addEventListener('input', () => {
    if (SCRAPED_DATA) {
        renderLinksTable(SCRAPED_DATA.links, linksSearch.value);
    }
});

imagesSearch.addEventListener('input', () => {
    if (SCRAPED_DATA) {
        renderImagesGrid(SCRAPED_DATA.images, imagesSearch.value);
    }
});

// Copy raw html content to clipboard
copyHtmlBtn.addEventListener('click', () => {
    if (SCRAPED_DATA) {
        navigator.clipboard.writeText(SCRAPED_DATA.raw_html);
        copyHtmlBtn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--color-success)"></i> Copied!';
        setTimeout(() => {
            copyHtmlBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Code';
        }, 2000);
        showToast('Raw HTML code copied to clipboard', 'success');
    }
});

// Helper: Escape HTML to avoid injection attacks during preview rendering
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// EXPORT TO DOWNLOAD FUNCTIONS

// 1. Export JSON
exportJsonBtn.addEventListener('click', () => {
    if (!SCRAPED_DATA) return;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(SCRAPED_DATA, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `scrape_result_${getCleanDomain(SCRAPED_DATA.url)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('JSON file download triggered.', 'success');
});

// 2. Export CSV Summary
exportCsvBtn.addEventListener('click', () => {
    if (!SCRAPED_DATA) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Key/Value\r\n";
    csvContent += `URL,${SCRAPED_DATA.url}\r\n`;
    csvContent += `Title,${SCRAPED_DATA.title.replace(/"/g, '""')}\r\n`;
    csvContent += `Status,${SCRAPED_DATA.status_code}\r\n`;
    csvContent += `Links Count,${SCRAPED_DATA.summary.links_count}\r\n`;
    csvContent += `Images Count,${SCRAPED_DATA.summary.images_count}\r\n`;
    csvContent += `Tables Count,${SCRAPED_DATA.summary.tables_count}\r\n`;
    csvContent += `Headings Count,${SCRAPED_DATA.summary.headings_count}\r\n`;
    
    // Add Meta descriptors
    Object.keys(SCRAPED_DATA.meta).forEach(key => {
        csvContent += `Meta-${key.replace(/"/g, '""')},"${SCRAPED_DATA.meta[key].replace(/"/g, '""')}"\r\n`;
    });
    
    downloadTrigger(csvContent, `scrape_summary_${getCleanDomain(SCRAPED_DATA.url)}.csv`);
});

// 3. Download Links as CSV
downloadLinksCsv.addEventListener('click', () => {
    if (!SCRAPED_DATA) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Text,URL,Type\r\n";
    
    SCRAPED_DATA.links.forEach(l => {
        const text = l.text.replace(/"/g, '""');
        const href = l.href.replace(/"/g, '""');
        const type = l.is_external ? 'External' : 'Internal';
        csvContent += `"${text}","${href}","${type}"\r\n`;
    });
    
    downloadTrigger(csvContent, `links_${getCleanDomain(SCRAPED_DATA.url)}.csv`);
});

// 4. Download Images as CSV
downloadImagesCsv.addEventListener('click', () => {
    if (!SCRAPED_DATA) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Description (Alt Text),Source URL\r\n";
    
    SCRAPED_DATA.images.forEach(i => {
        const alt = i.alt.replace(/"/g, '""');
        const src = i.src.replace(/"/g, '""');
        csvContent += `"${alt}","${src}"\r\n`;
    });
    
    downloadTrigger(csvContent, `images_${getCleanDomain(SCRAPED_DATA.url)}.csv`);
});

// 5. Download Custom Selector Findings as CSV
downloadSelectorCsv.addEventListener('click', () => {
    if (!SCRAPED_DATA || !SCRAPED_DATA.custom_selector) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Match Index,Tag,Text Content,Outer HTML\r\n";
    
    SCRAPED_DATA.custom_selector.matches.forEach((m, idx) => {
        const tag = m.tag.replace(/"/g, '""');
        const text = m.text.replace(/"/g, '""');
        const html = m.outer_html.replace(/"/g, '""');
        csvContent += `"${idx+1}","${tag}","${text}","${html}"\r\n`;
    });
    
    downloadTrigger(csvContent, `selector_matches_${getCleanDomain(SCRAPED_DATA.url)}.csv`);
});

// 6. Download Selected Table as CSV
downloadTableCsv.addEventListener('click', () => {
    if (!SCRAPED_DATA || SCRAPED_DATA.tables.length === 0) return;
    
    const selectedId = parseInt(tableDropdown.value);
    const table = SCRAPED_DATA.tables.find(t => t.id === selectedId);
    
    if (!table) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    // Headers
    csvContent += table.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + "\r\n";
    // Rows
    table.rows.forEach(row => {
        csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + "\r\n";
    });
    
    downloadTrigger(csvContent, `table_${selectedId}_${getCleanDomain(SCRAPED_DATA.url)}.csv`);
});

// Download Triggers wrapper
function downloadTrigger(content, filename) {
    const encodedUri = encodeURI(content);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`${filename} download triggered successfully.`, 'success');
}

// Clean Domain name fetcher
function getCleanDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '').replace(/\./g, '_');
    } catch(e) {
        return 'scraped_page';
    }
}
