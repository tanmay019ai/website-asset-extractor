/**
 * Website Asset Extractor — Content Script
 * Injected into the active webpage to scan and extract all assets.
 * Self-contained: includes all utility functions inline.
 * Sends results back via chrome.runtime.sendMessage.
 */

(() => {
  'use strict';

  // ─── Inline Utilities ───────────────────────────────────────────────
  const baseUrl = document.baseURI || location.href;

  function toAbsoluteUrl(url) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url || url === '#' || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:')) return null;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    try { return new URL(url, baseUrl).href; } catch { return null; }
  }

  function getFilename(url) {
    if (!url) return 'unknown';
    if (url.startsWith('data:')) {
      const mime = url.split(';')[0].split('/')[1] || 'bin';
      return 'data-file.' + mime.split('+')[0];
    }
    if (url.startsWith('blob:')) return 'blob-file';
    try {
      const p = new URL(url).pathname.split('/').filter(Boolean);
      return decodeURIComponent(p[p.length - 1] || 'unknown').substring(0, 120);
    } catch { return 'unknown'; }
  }

  function getExtension(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return (url.split(';')[0].split('/')[1] || '').split('+')[0].toLowerCase();
    try {
      const m = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/);
      return m ? m[1].toLowerCase() : '';
    } catch { return ''; }
  }

  function dedupe(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const v = item[key];
      if (!v || seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  }

  // ─── Image Extensions ───────────────────────────────────────────────
  const IMG_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','ico','avif','tiff','tif','heic','heif','svg']);
  const VIDEO_EXTS = new Set(['mp4','webm','ogg','ogv','mov','avi','mkv','m4v','flv','wmv']);
  const AUDIO_EXTS = new Set(['mp3','wav','ogg','oga','m4a','aac','flac','wma','opus']);
  const FILE_EXTS = new Set(['pdf','zip','rar','7z','tar','gz','doc','docx','xls','xlsx','ppt','pptx','csv','txt','rtf','epub','dmg','exe','msi','deb','rpm','apk','ipa']);

  // ─── Results Container ──────────────────────────────────────────────
  const results = {
    images: [],
    svgs: [],
    videos: [],
    audio: [],
    links: [],
    fonts: [],
    css: [],
    js: [],
    favicons: [],
    files: [],
    pageInfo: {
      title: document.title || '',
      url: location.href,
      domain: location.hostname
    }
  };

  try {

    // ─── 1. IMAGES ──────────────────────────────────────────────────

    // 1a. <img> elements
    document.querySelectorAll('img').forEach(img => {
      const urls = new Set();

      // Standard src
      const src = toAbsoluteUrl(img.currentSrc || img.src);
      if (src) urls.add(src);

      // Lazy-loading attributes
      ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-full-src', 'data-hi-res-src'].forEach(attr => {
        const val = toAbsoluteUrl(img.getAttribute(attr));
        if (val) urls.add(val);
      });

      // srcset
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (srcset) {
        srcset.split(',').forEach(entry => {
          const parts = entry.trim().split(/\s+/);
          const u = toAbsoluteUrl(parts[0]);
          if (u) urls.add(u);
        });
      }

      urls.forEach(url => {
        const ext = getExtension(url);
        if (ext === 'svg') {
          results.svgs.push({ content: null, url, filename: getFilename(url), isInline: false, viewBox: '' });
        } else {
          results.images.push({
            url,
            filename: getFilename(url),
            width: img.naturalWidth || img.width || null,
            height: img.naturalHeight || img.height || null,
            type: ext.toUpperCase() || 'IMG',
            alt: (img.alt || '').substring(0, 200)
          });
        }
      });
    });

    // 1b. <picture> sources
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach(entry => {
          const url = toAbsoluteUrl(entry.trim().split(/\s+/)[0]);
          if (url) {
            results.images.push({
              url,
              filename: getFilename(url),
              width: null, height: null,
              type: getExtension(url).toUpperCase() || 'IMG',
              alt: ''
            });
          }
        });
      }
    });

    // 1c. <input type="image">
    document.querySelectorAll('input[type="image"]').forEach(input => {
      const url = toAbsoluteUrl(input.src);
      if (url) {
        results.images.push({
          url, filename: getFilename(url),
          width: input.width || null, height: input.height || null,
          type: getExtension(url).toUpperCase() || 'IMG', alt: input.alt || ''
        });
      }
    });

    // 1d. CSS background-image (sample up to 500 elements)
    const allElements = document.querySelectorAll('*');
    const limit = Math.min(allElements.length, 500);
    for (let i = 0; i < limit; i++) {
      try {
        const style = getComputedStyle(allElements[i]);
        const bg = style.backgroundImage;
        if (bg && bg !== 'none') {
          const urlMatches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
          for (const match of urlMatches) {
            const url = toAbsoluteUrl(match[1]);
            if (url && !url.startsWith('data:image/svg')) {
              const ext = getExtension(url);
              if (ext === 'svg') {
                results.svgs.push({ content: null, url, filename: getFilename(url), isInline: false, viewBox: '' });
              } else {
                results.images.push({
                  url, filename: getFilename(url),
                  width: null, height: null,
                  type: ext.toUpperCase() || 'IMG', alt: ''
                });
              }
            }
          }
        }
      } catch { /* skip inaccessible elements */ }
    }

    // ─── 2. SVGs ────────────────────────────────────────────────────

    // 2a. Inline <svg> elements
    const serializer = new XMLSerializer();
    document.querySelectorAll('svg').forEach((svg, index) => {
      try {
        // Skip tiny decoration SVGs (like dots or separators)
        const content = serializer.serializeToString(svg);
        const viewBox = svg.getAttribute('viewBox') || '';
        results.svgs.push({
          content,
          url: null,
          filename: `inline-svg-${index + 1}.svg`,
          isInline: true,
          viewBox
        });
      } catch { /* skip unserializable SVGs */ }
    });

    // 2b. External SVGs via <object>, <embed>, <iframe>
    document.querySelectorAll('object[data$=".svg"], embed[src$=".svg"]').forEach(el => {
      const url = toAbsoluteUrl(el.getAttribute('data') || el.getAttribute('src'));
      if (url) {
        results.svgs.push({ content: null, url, filename: getFilename(url), isInline: false, viewBox: '' });
      }
    });

    // ─── 3. VIDEOS ──────────────────────────────────────────────────

    // 3a. <video> elements
    document.querySelectorAll('video').forEach(video => {
      const src = toAbsoluteUrl(video.src || video.getAttribute('src'));
      if (src) {
        results.videos.push({ url: src, filename: getFilename(src), type: getExtension(src).toUpperCase() || 'VIDEO' });
      }
      video.querySelectorAll('source').forEach(source => {
        const url = toAbsoluteUrl(source.src || source.getAttribute('src'));
        if (url) {
          results.videos.push({ url, filename: getFilename(url), type: getExtension(url).toUpperCase() || 'VIDEO' });
        }
      });
    });

    // 3b. Video links from <a> tags
    document.querySelectorAll('a[href]').forEach(a => {
      const url = toAbsoluteUrl(a.href);
      if (url && VIDEO_EXTS.has(getExtension(url))) {
        results.videos.push({ url, filename: getFilename(url), type: getExtension(url).toUpperCase() });
      }
    });

    // ─── 4. AUDIO ───────────────────────────────────────────────────

    document.querySelectorAll('audio').forEach(audio => {
      const src = toAbsoluteUrl(audio.src || audio.getAttribute('src'));
      if (src) {
        results.audio.push({ url: src, filename: getFilename(src), type: getExtension(src).toUpperCase() || 'AUDIO' });
      }
      audio.querySelectorAll('source').forEach(source => {
        const url = toAbsoluteUrl(source.src || source.getAttribute('src'));
        if (url) {
          results.audio.push({ url, filename: getFilename(url), type: getExtension(url).toUpperCase() || 'AUDIO' });
        }
      });
    });

    // Audio links from <a> tags
    document.querySelectorAll('a[href]').forEach(a => {
      const url = toAbsoluteUrl(a.href);
      if (url && AUDIO_EXTS.has(getExtension(url))) {
        results.audio.push({ url, filename: getFilename(url), type: getExtension(url).toUpperCase() });
      }
    });

    // ─── 5. LINKS ───────────────────────────────────────────────────

    document.querySelectorAll('a[href]').forEach(a => {
      const url = toAbsoluteUrl(a.href);
      if (!url) return;
      const ext = getExtension(url);
      // Skip asset links already captured
      if (VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FILE_EXTS.has(ext)) return;
      const text = (a.innerText || a.textContent || '').trim().substring(0, 200) || url;
      results.links.push({ url, text });
    });

    // ─── 6. FONTS ───────────────────────────────────────────────────

    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule instanceof CSSFontFaceRule) {
            const family = (rule.style.getPropertyValue('font-family') || '').replace(/['"]/g, '').trim();
            const srcValue = rule.style.getPropertyValue('src') || rule.cssText || '';
            const urlMatches = srcValue.matchAll(/url\(["']?([^"')]+)["']?\)\s*(?:format\(["']?([^"')]+)["']?\))?/g);

            for (const match of urlMatches) {
              const url = toAbsoluteUrl(match[1]);
              if (url) {
                let format = match[2] || getExtension(url) || '';
                format = format.replace(/['"]/g, '').toUpperCase();
                results.fonts.push({ family, url, format });
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — cannot access rules
      }
    }

    // ─── 7. CSS FILES ───────────────────────────────────────────────

    document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]').forEach(link => {
      const url = toAbsoluteUrl(link.href);
      if (url) {
        results.css.push({ url, filename: getFilename(url) });
      }
    });

    // ─── 8. JS FILES ────────────────────────────────────────────────

    document.querySelectorAll('script[src]').forEach(script => {
      const url = toAbsoluteUrl(script.src);
      if (url) {
        results.js.push({ url, filename: getFilename(url) });
      }
    });

    // ─── 9. FAVICONS ────────────────────────────────────────────────

    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="mask-icon"]'
    ];
    document.querySelectorAll(faviconSelectors.join(',')).forEach(link => {
      const url = toAbsoluteUrl(link.href);
      if (url) {
        results.favicons.push({
          url,
          filename: getFilename(url),
          sizes: link.getAttribute('sizes') || ''
        });
      }
    });

    // ─── 10. DOWNLOADABLE FILES ─────────────────────────────────────

    document.querySelectorAll('a[href]').forEach(a => {
      const url = toAbsoluteUrl(a.href);
      if (url && FILE_EXTS.has(getExtension(url))) {
        results.files.push({
          url,
          filename: getFilename(url),
          type: getExtension(url).toUpperCase()
        });
      }
    });

  } catch (err) {
    console.error('[WAE] Scan error:', err);
  }

  // ─── Deduplicate All Arrays ─────────────────────────────────────────

  results.images = dedupe(results.images, 'url');
  results.svgs = dedupe(results.svgs.filter(s => s.url || s.content), s => s.url || s.content ? 'url' : 'content');
  results.videos = dedupe(results.videos, 'url');
  results.audio = dedupe(results.audio, 'url');
  results.links = dedupe(results.links, 'url');
  results.fonts = dedupe(results.fonts, 'url');
  results.css = dedupe(results.css, 'url');
  results.js = dedupe(results.js, 'url');
  results.favicons = dedupe(results.favicons, 'url');
  results.files = dedupe(results.files, 'url');

  // SVG dedup: separate inline (by content hash) and external (by URL)
  const svgSeen = new Set();
  results.svgs = results.svgs.filter(s => {
    const key = s.url || (s.content || '').substring(0, 200);
    if (svgSeen.has(key)) return false;
    svgSeen.add(key);
    return true;
  });

  // ─── Send Results Back ──────────────────────────────────────────────

  chrome.runtime.sendMessage({ type: 'SCAN_RESULTS', data: results });
})();
