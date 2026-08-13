/**
 * Website Asset Extractor — Shared Utilities
 * Reusable helper functions for URL handling, formatting, and data processing.
 */

const Utils = {

  /**
   * Convert a potentially relative URL to an absolute URL.
   * @param {string} url - The URL to convert.
   * @param {string} [baseUrl] - The base URL for resolution. Defaults to current page.
   * @returns {string|null} The absolute URL, or null if invalid.
   */
  toAbsoluteUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url || url === '#' || url.startsWith('javascript:')) return null;

    // Already absolute
    if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    // Protocol-relative
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    try {
      const base = baseUrl || (typeof location !== 'undefined' ? location.href : '');
      return new URL(url, base).href;
    } catch {
      return null;
    }
  },

  /**
   * Extract a human-readable filename from a URL.
   * @param {string} url - The URL to extract from.
   * @returns {string} The filename or 'unknown'.
   */
  getFilename(url) {
    if (!url || typeof url !== 'string') return 'unknown';
    if (url.startsWith('data:')) {
      const mime = url.split(';')[0].split('/')[1] || 'bin';
      return `data-file.${mime.split('+')[0]}`;
    }
    if (url.startsWith('blob:')) return 'blob-file';
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || 'unknown';
      return decodeURIComponent(last).substring(0, 120);
    } catch {
      const parts = url.split('/').filter(Boolean);
      return parts[parts.length - 1] || 'unknown';
    }
  },

  /**
   * Get file extension from URL (lowercase, no dot).
   * @param {string} url
   * @returns {string}
   */
  getExtension(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:')) {
      const mime = url.split(';')[0].split('/')[1] || '';
      return mime.split('+')[0].toLowerCase();
    }
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      return match ? match[1].toLowerCase() : '';
    } catch {
      const match = url.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      return match ? match[1].toLowerCase() : '';
    }
  },

  /**
   * Format bytes into a human-readable string.
   * @param {number} bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i] || 'TB'}`;
  },

  /**
   * Deduplicate an array of objects by a given key.
   * @param {Array} arr
   * @param {string} key
   * @returns {Array}
   */
  deduplicateByKey(arr, key) {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr.filter(item => {
      const val = item[key];
      if (!val || seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  },

  /**
   * Check if a string is a valid URL.
   * @param {string} url
   * @returns {boolean}
   */
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:') || url.startsWith('blob:')) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Determine the broad asset category from a URL's extension.
   * @param {string} url
   * @returns {string} One of: image, svg, video, audio, font, css, js, document, archive, unknown
   */
  getAssetType(url) {
    const ext = Utils.getExtension(url);
    const map = {
      image: ['png','jpg','jpeg','gif','webp','bmp','ico','avif','tiff','tif','heic','heif'],
      svg: ['svg'],
      video: ['mp4','webm','ogg','ogv','mov','avi','mkv','m4v','flv','wmv'],
      audio: ['mp3','wav','ogg','oga','m4a','aac','flac','wma','opus'],
      font: ['woff','woff2','ttf','otf','eot'],
      css: ['css'],
      js: ['js','mjs','cjs'],
      document: ['pdf','doc','docx','xls','xlsx','ppt','pptx','csv','txt','rtf','epub','md'],
      archive: ['zip','rar','7z','tar','gz','bz2','dmg','iso','exe','msi','deb','rpm','apk','ipa']
    };
    for (const [type, exts] of Object.entries(map)) {
      if (exts.includes(ext)) return type;
    }
    return 'unknown';
  },

  /**
   * Sanitize a filename for safe download.
   * @param {string} name
   * @returns {string}
   */
  sanitizeFilename(name) {
    if (!name) return 'download';
    return name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 200);
  },

  /**
   * Copy text to the clipboard.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  },

  /**
   * Generate a safe download filename from a URL.
   * @param {string} url
   * @param {string} [defaultName]
   * @returns {string}
   */
  getDownloadFilename(url, defaultName) {
    const name = Utils.getFilename(url);
    if (name && name !== 'unknown') return Utils.sanitizeFilename(name);
    return Utils.sanitizeFilename(defaultName || 'download');
  },

  /**
   * Truncate a string to a max length with ellipsis.
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  truncate(str, max = 60) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }
};
