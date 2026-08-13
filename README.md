# 🔍 Website Asset Extractor

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vanilla JS](https://img.shields.io/badge/JS-VanillaJS-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A powerful, high-performance Manifest V3 Chrome Extension that inspects, extracts, and downloads all web assets from any web page in real-time. Easily filter, preview, and download images, SVGs, audio, video, custom fonts, stylesheets, scripts, external links, and page metadata with a single click.

---

## 🌟 Key Features

Extract and manage a wide range of web page assets:

- **🖼️ Images**: Download standard image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.ico`, `.bmp`, `.avif`). Includes background image extraction from CSS styles.
- **🎨 SVGs**: Extract inline `<svg>` code snippets, SVG images, and SVG background icons. Export inline SVG code directly as standalone `.svg` files.
- **🎥 Videos**: Detect HTML5 video streams, source URLs (`.mp4`, `.webm`, `.ogv`), and embedded video links.
- **🎵 Audio**: Identify embedded audio files (`.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`, `.m4a`).
- **🔗 Links & Media**: Deep scan all hyperlink URLs (`<a href>`), canonical tags, and external references.
- **🔤 Web Fonts**: Inspect active `@font-face` definitions and download web font files (`.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`).
- **🎨 CSS & Stylesheets**: Extract linked external stylesheets (`.css`) and inline style declarations.
- **⚡ JavaScript Code**: Scrape and export linked external `.js` scripts and dynamic resource imports.
- **📄 Page Metadata**: View and export structured page metadata, Open Graph (OG) tags, and document title/description.
- **📦 Batch Download**: Download selected assets in bulk or export asset URLs as formatted plain text files (`.txt`).

---

## 📸 Screenshots

> *Screenshots coming soon!*

| Asset Overview | Image Filter & Preview | SVG Code Inspector |
| :---: | :---: | :---: |
| *[ Placeholder: Main Dashboard ]* | *[ Placeholder: Image Grid ]* | *[ Placeholder: SVG Modal ]* |

---

## 🚀 Installation Instructions

Since **Website Asset Extractor** is built using Manifest V3, you can easily load it as an unpacked developer extension in any Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Opera).

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/tanmay019ai/website-asset-extractor.git
   ```
2. Open Chrome and navigate to the extensions page:
   `chrome://extensions`
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `website-asset-extractor` directory containing `manifest.json`.
6. The extension icon 🔍 will appear in your browser toolbar!

---

## 🛠️ Usage Instructions

1. **Navigate to Any Web Page**: Open the target site whose assets you wish to inspect or download.
2. **Open Extension**: Click the **Website Asset Extractor** icon in your Chrome toolbar.
3. **Scan Assets**: The extension automatically analyzes the current active tab and categorizes assets into tabs (Images, SVGs, Media, Fonts, Scripts, CSS, Links).
4. **Preview Assets**: Hover or click on asset items to preview images, inspect SVG code, or verify source URLs.
5. **Download Assets**:
   - Click the **Download** button on any individual asset card to save it locally.
   - Use **Download SVG** for inline SVG graphics.
   - Click **Export Text** to save the list of extracted URLs as a `.txt` file.

---

## 🔒 Permissions Explanation

This extension requests minimal required permissions in compliance with Chrome Manifest V3 security standards:

| Permission | Purpose |
| :--- | :--- |
| `activeTab` | Grants temporary access to the current active tab when you click the extension popup to scan DOM assets. |
| `scripting` | Executes lightweight content scripts to read DOM nodes, CSS rules, inline SVGs, and computed styles. |
| `downloads` | Uses the native `chrome.downloads` API to save extracted images, media, text, and SVG files directly to your device. |

---

## 🧰 Tech Stack

- **Manifest Version**: Manifest V3
- **Language**: Vanilla JavaScript (ES6+)
- **UI Markup & Styling**: HTML5, Modern CSS3 (CSS Grid/Flexbox)
- **APIs**: Chrome Web Extension APIs (`chrome.downloads`, `chrome.scripting`, `chrome.runtime`, `chrome.tabs`)

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout -b feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more details.

---

## 👨‍💻 Author

**tanmay019ai**
- GitHub: [@tanmay019ai](https://github.com/tanmay019ai)
