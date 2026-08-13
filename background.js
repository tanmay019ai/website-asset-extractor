/**
 * Website Asset Extractor - Background Service Worker (Manifest V3)
 * Handles file downloads, SVG blob/data URLs, text file exports, and messaging relay.
 */

// Listener for runtime messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  console.log(`[Background] Message received: ${message.type}`, message);

  switch (message.type) {
    case 'DOWNLOAD':
      return handleDownload(message, sendResponse);

    case 'DOWNLOAD_SVG':
      return handleDownloadSVG(message, sendResponse);

    case 'DOWNLOAD_TXT':
      return handleDownloadTXT(message, sendResponse);

    case 'RELAY_TO_POPUP':
      return handleRelayToPopup(message, sender, sendResponse);

    case 'RELAY_TO_CONTENT':
      return handleRelayToContent(message, sender, sendResponse);

    default:
      console.warn(`[Background] Unknown message type: ${message.type}`);
      return false;
  }
});

/**
 * Handle direct file download requests
 */
function handleDownload(message, sendResponse) {
  if (!message.url) {
    sendResponse({ success: false, error: 'No URL provided for download.' });
    return false;
  }

  const options = {
    url: message.url,
    filename: message.filename || undefined,
    saveAs: false
  };

  chrome.downloads.download(options, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[Background] Download failed:', chrome.runtime.lastError.message);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      console.log(`[Background] Download started with ID: ${downloadId}`);
      sendResponse({ success: true, downloadId });
    }
  });

  return true; // async response
}

/**
 * Handle SVG string content download via Data URL
 */
function handleDownloadSVG(message, sendResponse) {
  if (!message.content) {
    sendResponse({ success: false, error: 'No SVG content provided.' });
    return false;
  }

  try {
    const svgContent = message.content;
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
    const filename = message.filename || 'inline.svg';

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] SVG Download failed:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log(`[Background] SVG Download started with ID: ${downloadId}`);
        sendResponse({ success: true, downloadId });
      }
    });
  } catch (err) {
    console.error('[Background] Error processing SVG download:', err);
    sendResponse({ success: false, error: err.message });
  }

  return true; // async response
}

/**
 * Handle Text content download via Data URL
 */
function handleDownloadTXT(message, sendResponse) {
  if (message.content === undefined || message.content === null) {
    sendResponse({ success: false, error: 'No text content provided.' });
    return false;
  }

  try {
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(message.content);
    const filename = message.filename || 'export.txt';

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] TXT Download failed:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log(`[Background] TXT Download started with ID: ${downloadId}`);
        sendResponse({ success: true, downloadId });
      }
    });
  } catch (err) {
    console.error('[Background] Error processing TXT download:', err);
    sendResponse({ success: false, error: err.message });
  }

  return true; // async response
}

/**
 * Relay messages from Content script to Popup if Popup is active
 */
function handleRelayToPopup(message, sender, sendResponse) {
  chrome.runtime.sendMessage(message.payload, (response) => {
    if (chrome.runtime.lastError) {
      console.log('[Background] Popup may be closed, could not relay:', chrome.runtime.lastError.message);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, response });
    }
  });
  return true;
}

/**
 * Relay messages from Popup to active tab Content script
 */
function handleRelayToContent(message, sender, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      sendResponse({ success: false, error: 'No active tab found.' });
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, message.payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error sending to content script:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, response });
      }
    });
  });
  return true;
}
