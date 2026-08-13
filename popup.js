/**
 * Website Asset Extractor — Popup Controller
 * Handles scanning, rendering, filtering, sorting, and all user interactions.
 */

(() => {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  let scanData = null;
  let currentTab = 'all';
  let searchQuery = '';
  let sortBy = 'name';

  // ─── Tab Configuration ──────────────────────────────────────────────
  const TABS = [
    { key: 'all',      label: 'All',      icon: '📦' },
    { key: 'images',   label: 'Images',   icon: '🖼️' },
    { key: 'svgs',     label: 'SVG',      icon: '🎨' },
    { key: 'videos',   label: 'Videos',   icon: '🎬' },
    { key: 'audio',    label: 'Audio',    icon: '🔊' },
    { key: 'links',    label: 'Links',    icon: '🔗' },
    { key: 'fonts',    label: 'Fonts',    icon: '🔤' },
    { key: 'css',      label: 'CSS',      icon: '🎨' },
    { key: 'js',       label: 'JS',       icon: '⚡' },
    { key: 'favicons', label: 'Favicons', icon: '⭐' },
    { key: 'files',    label: 'Files',    icon: '📁' }
  ];

  // ─── DOM References ─────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const scanBtn = $('scanBtn');
  const scanSection = $('scanSection');
  const loadingState = $('loadingState');
  const errorState = $('errorState');
  const errorMessage = $('errorMessage');
  const retryBtn = $('retryBtn');
  const resultsContainer = $('resultsContainer');
  const pageInfoEl = $('pageInfo');
  const statsBar = $('statsBar');
  const tabBar = $('tabBar');
  const searchInput = $('searchInput');
  const sortSelect = $('sortSelect');
  const assetsList = $('assetsList');
  const emptyState = $('emptyState');
  const copyAllBtn = $('copyAllBtn');
  const exportTxtBtn = $('exportTxtBtn');
  const assetCount = $('assetCount');
  const toast = $('toast');

  // ─── Initialization ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    scanBtn.addEventListener('click', startScan);
    retryBtn.addEventListener('click', startScan);
    searchInput.addEventListener('input', handleSearch);
    sortSelect.addEventListener('change', handleSort);
    copyAllBtn.addEventListener('click', copyAllUrls);
    exportTxtBtn.addEventListener('click', exportAsTxt);

    // Listen for scan results from content script
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  // ─── Scanning ───────────────────────────────────────────────────────

  function startScan() {
    showLoading();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        showError('No active tab found.');
        return;
      }

      const tab = tabs[0];

      // Check if we can inject into this page
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('devtools://')) {
        showError('Cannot scan browser internal pages. Navigate to a regular website and try again.');
        return;
      }

      // Set a timeout for the scan
      const timeout = setTimeout(() => {
        showError('Scan timed out. The page may be too complex or restricted.');
      }, 15000);

      // Store timeout ID so we can clear it when results arrive
      window._scanTimeout = timeout;

      // Inject content script
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(err => {
        clearTimeout(timeout);
        console.error('Injection failed:', err);
        showError('Unable to scan this page. It may be restricted by the browser or require special permissions.');
      });
    });
  }

  function handleMessage(message) {
    if (message.type === 'SCAN_RESULTS' && message.data) {
      if (window._scanTimeout) {
        clearTimeout(window._scanTimeout);
        window._scanTimeout = null;
      }
      scanData = message.data;
      displayResults();
    }
  }

  // ─── Display States ─────────────────────────────────────────────────

  function showLoading() {
    scanSection.classList.add('hidden');
    errorState.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    scanBtn.classList.add('scanning');
  }

  function showError(msg) {
    loadingState.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    scanSection.classList.remove('hidden');
    scanBtn.classList.remove('scanning');
    errorMessage.textContent = msg;
    errorState.classList.remove('hidden');
  }

  function displayResults() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    scanSection.classList.add('hidden');
    scanBtn.classList.remove('scanning');
    resultsContainer.classList.remove('hidden');

    renderPageInfo();
    renderStats();
    renderTabs();
    renderAssets();
  }

  // ─── Page Info ──────────────────────────────────────────────────────

  function renderPageInfo() {
    if (!scanData.pageInfo) return;
    const { title, domain } = scanData.pageInfo;
    pageInfoEl.innerHTML = `<span class="page-domain">${escapeHtml(domain)}</span> — ${escapeHtml(truncate(title, 50))}`;
  }

  // ─── Stats ──────────────────────────────────────────────────────────

  function renderStats() {
    const counts = getCounts();
    statsBar.innerHTML = TABS.filter(t => t.key !== 'all').map(t => {
      const count = counts[t.key] || 0;
      const hasClass = count > 0 ? 'has-items' : '';
      return `<div class="stat-chip ${hasClass}" data-tab="${t.key}">
        <span>${t.icon}</span>
        <span>${t.label}</span>
        <span class="stat-count">${count}</span>
      </div>`;
    }).join('');

    // Click stat chip to switch tab
    statsBar.querySelectorAll('.stat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tab = chip.dataset.tab;
        switchTab(tab);
      });
    });
  }

  function getCounts() {
    if (!scanData) return {};
    return {
      images: scanData.images?.length || 0,
      svgs: scanData.svgs?.length || 0,
      videos: scanData.videos?.length || 0,
      audio: scanData.audio?.length || 0,
      links: scanData.links?.length || 0,
      fonts: scanData.fonts?.length || 0,
      css: scanData.css?.length || 0,
      js: scanData.js?.length || 0,
      favicons: scanData.favicons?.length || 0,
      files: scanData.files?.length || 0
    };
  }

  // ─── Tabs ───────────────────────────────────────────────────────────

  function renderTabs() {
    tabBar.innerHTML = TABS.map(t => {
      const active = t.key === currentTab ? 'active' : '';
      return `<button class="tab-btn ${active}" data-tab="${t.key}">${t.label}</button>`;
    }).join('');

    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    renderTabs();
    renderAssets();
  }

  // ─── Search & Sort ──────────────────────────────────────────────────

  function handleSearch() {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderAssets();
  }

  function handleSort() {
    sortBy = sortSelect.value;
    renderAssets();
  }

  // ─── Render Assets ──────────────────────────────────────────────────

  function renderAssets() {
    if (!scanData) return;

    let html = '';
    let totalCount = 0;

    if (currentTab === 'all') {
      // Show all categories with section headers
      TABS.filter(t => t.key !== 'all').forEach(t => {
        const items = getFilteredItems(t.key);
        if (items.length === 0) return;
        totalCount += items.length;
        html += `<div class="section-header">${t.icon} ${t.label} <span class="section-count">${items.length}</span></div>`;
        html += items.map((item, i) => renderCard(t.key, item, i)).join('');
      });
    } else {
      const items = getFilteredItems(currentTab);
      totalCount = items.length;
      html = items.map((item, i) => renderCard(currentTab, item, i)).join('');
    }

    assetsList.innerHTML = html;
    assetCount.textContent = `${totalCount} asset${totalCount !== 1 ? 's' : ''}`;

    if (totalCount === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

    // Bind action buttons
    bindActions();
  }

  function getFilteredItems(type) {
    let items = [...(scanData[type] || [])];

    // Search filter
    if (searchQuery) {
      items = items.filter(item => {
        const searchable = [
          item.filename, item.url, item.text, item.family, item.alt, item.format
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(searchQuery);
      });
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.filename || a.text || a.family || '').localeCompare(b.filename || b.text || b.family || '');
      }
      if (sortBy === 'type') {
        return (a.type || a.format || '').localeCompare(b.type || b.format || '');
      }
      return 0;
    });

    return items;
  }

  // ─── Card Renderers ─────────────────────────────────────────────────

  function renderCard(type, item, index) {
    const delay = Math.min(index * 0.03, 0.5);
    const style = `animation-delay: ${delay}s`;

    switch (type) {
      case 'images': return renderImageCard(item, style);
      case 'svgs': return renderSvgCard(item, style);
      case 'videos': return renderVideoCard(item, style);
      case 'audio': return renderAudioCard(item, style);
      case 'links': return renderLinkCard(item, style);
      case 'fonts': return renderFontCard(item, style);
      case 'css': return renderCssCard(item, style);
      case 'js': return renderJsCard(item, style);
      case 'favicons': return renderFaviconCard(item, style);
      case 'files': return renderFileCard(item, style);
      default: return '';
    }
  }

  function renderImageCard(item, style) {
    const dims = (item.width && item.height) ? `${item.width} × ${item.height}` : '';
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb">
        <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.alt)}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="asset-info">
        <div class="asset-name" title="${escapeAttr(item.filename)}">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          ${dims ? `<span class="asset-dimensions">${dims}</span>` : ''}
          ${item.type ? `<span class="asset-badge">${escapeHtml(item.type)}</span>` : ''}
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderSvgCard(item, style) {
    let preview = '';
    if (item.isInline && item.content) {
      // Render inline SVG preview (sanitized in container)
      preview = `<div class="svg-preview">${item.content}</div>`;
    } else if (item.url) {
      preview = `<div class="asset-thumb"><img src="${escapeAttr(item.url)}" loading="lazy" onerror="this.style.display='none'"></div>`;
    } else {
      preview = `<div class="asset-thumb-icon">🎨</div>`;
    }

    const actions = [];
    if (item.isInline && item.content) {
      actions.push(`<button class="action-btn" data-action="copy-svg" data-content="${escapeAttr(item.content)}">📋 Copy SVG</button>`);
      actions.push(`<button class="action-btn" data-action="download-svg" data-content="${escapeAttr(item.content)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>`);
    } else if (item.url) {
      actions.push(`<button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy URL</button>`);
      actions.push(`<button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>`);
      actions.push(`<button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>`);
    }

    return `<div class="asset-card" style="${style}">
      ${preview}
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          ${item.viewBox ? `<span class="asset-dimensions">${escapeHtml(item.viewBox)}</span>` : ''}
          <span class="asset-badge">SVG</span>
          ${item.isInline ? '<span class="asset-badge">INLINE</span>' : ''}
        </div>
        ${item.url ? `<div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>` : ''}
        <div class="asset-actions">${actions.join('')}</div>
      </div>
    </div>`;
  }

  function renderVideoCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">🎬</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          <span class="asset-badge">${escapeHtml(item.type)}</span>
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderAudioCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">🔊</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          <span class="asset-badge">${escapeHtml(item.type)}</span>
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderLinkCard(item, style) {
    return `<div class="asset-card link-card" style="${style}">
      <div class="asset-thumb-icon">🔗</div>
      <div class="asset-info">
        <div class="asset-name" title="${escapeAttr(item.text)}">${escapeHtml(truncate(item.text, 60))}</div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderFontCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">🔤</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.family || 'Unknown Font')}</div>
        <div class="asset-meta">
          ${item.format ? `<span class="asset-badge">${escapeHtml(item.format)}</span>` : ''}
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.family + '.' + (item.format || 'font').toLowerCase())}">⬇ Download</button>
        </div>
      </div>
    </div>`;
  }

  function renderCssCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">🎨</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta"><span class="asset-badge">CSS</span></div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderJsCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">⚡</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta"><span class="asset-badge">JS</span></div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderFaviconCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb">
        <img src="${escapeAttr(item.url)}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          <span class="asset-badge">FAVICON</span>
          ${item.sizes ? `<span class="asset-dimensions">${escapeHtml(item.sizes)}</span>` : ''}
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  function renderFileCard(item, style) {
    return `<div class="asset-card" style="${style}">
      <div class="asset-thumb-icon">📁</div>
      <div class="asset-info">
        <div class="asset-name">${escapeHtml(item.filename)}</div>
        <div class="asset-meta">
          <span class="asset-badge">${escapeHtml(item.type)}</span>
        </div>
        <div class="asset-url" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</div>
        <div class="asset-actions">
          <button class="action-btn" data-action="copy" data-url="${escapeAttr(item.url)}">📋 Copy</button>
          <button class="action-btn" data-action="download" data-url="${escapeAttr(item.url)}" data-filename="${escapeAttr(item.filename)}">⬇ Download</button>
          <button class="action-btn" data-action="open" data-url="${escapeAttr(item.url)}">↗ Open</button>
        </div>
      </div>
    </div>`;
  }

  // ─── Action Binding ─────────────────────────────────────────────────

  function bindActions() {
    assetsList.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', handleAction);
    });
  }

  function handleAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;

    switch (action) {
      case 'copy':
        copyUrl(btn.dataset.url, btn);
        break;
      case 'copy-svg':
        copySvg(btn.dataset.content, btn);
        break;
      case 'download':
        downloadFile(btn.dataset.url, btn.dataset.filename);
        break;
      case 'download-svg':
        downloadSvg(btn.dataset.content, btn.dataset.filename);
        break;
      case 'open':
        openUrl(btn.dataset.url);
        break;
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async function copyUrl(url, btn) {
    try {
      await navigator.clipboard.writeText(url);
      showCopyFeedback(btn);
      showToast('URL copied to clipboard!');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyFeedback(btn);
      showToast('URL copied to clipboard!');
    }
  }

  async function copySvg(content, btn) {
    try {
      await navigator.clipboard.writeText(content);
      showCopyFeedback(btn);
      showToast('SVG code copied!');
    } catch {
      showToast('Failed to copy SVG');
    }
  }

  function downloadFile(url, filename) {
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD',
      url: url,
      filename: filename || undefined
    }, (response) => {
      if (response?.success) {
        showToast('Download started!');
      } else {
        showToast('Download failed: ' + (response?.error || 'Unknown error'));
      }
    });
  }

  function downloadSvg(content, filename) {
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_SVG',
      content: content,
      filename: filename || 'inline.svg'
    }, (response) => {
      if (response?.success) {
        showToast('SVG download started!');
      } else {
        showToast('Download failed');
      }
    });
  }

  function openUrl(url) {
    chrome.tabs.create({ url, active: false });
  }

  // ─── Bulk Actions ───────────────────────────────────────────────────

  async function copyAllUrls() {
    const urls = collectVisibleUrls();
    if (urls.length === 0) {
      showToast('No URLs to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      showToast(`${urls.length} URLs copied!`);
    } catch {
      showToast('Failed to copy URLs');
    }
  }

  function exportAsTxt() {
    const urls = collectVisibleUrls();
    if (urls.length === 0) {
      showToast('No URLs to export');
      return;
    }
    const domain = scanData?.pageInfo?.domain || 'assets';
    const content = `Website Asset Extractor — Export\nSource: ${scanData?.pageInfo?.url || ''}\nDate: ${new Date().toISOString()}\n${'─'.repeat(50)}\n\n${urls.join('\n')}`;

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_TXT',
      content: content,
      filename: `${domain}-assets.txt`
    });
    showToast('Exporting as TXT…');
  }

  function collectVisibleUrls() {
    const urls = [];
    if (currentTab === 'all') {
      TABS.filter(t => t.key !== 'all').forEach(t => {
        getFilteredItems(t.key).forEach(item => {
          if (item.url) urls.push(item.url);
        });
      });
    } else {
      getFilteredItems(currentTab).forEach(item => {
        if (item.url) urls.push(item.url);
      });
    }
    return urls;
  }

  // ─── UI Feedback ────────────────────────────────────────────────────

  function showCopyFeedback(btn) {
    btn.classList.add('copy-success');
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Copied';
    setTimeout(() => {
      btn.classList.remove('copy-success');
      btn.innerHTML = original;
    }, 1500);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2000);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function truncate(str, max = 60) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

})();
