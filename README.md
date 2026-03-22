# 🎬 BLU. ARCHIVE - Video Manager

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Wails](https://img.shields.io/badge/built%20with-Wails%20v2-red)
![Go](https://img.shields.io/badge/backend-Go-00ADD8?logo=go)
![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react)

**BLU. ARCHIVE** is a personal video gallery management desktop application built using **Wails v2**, **Go**, and **React**. This application allows you to manage your local video collection with a modern interface inspired by minimalist and aesthetic themes.

## ✨ Key Features
* **Auto Thumbnail Generation**: Automatically capture screenshots from videos using FFmpeg.
* **Metadata Editor**: Directly edit video titles, artists, release years, and descriptions.
* **Safe File Renaming**: Intelligently renames physical files safely without overwriting other data.
* **Integrated Database**: Uses SQLite for fast and portable data storage.
* **Custom Blue Archive UI**: Clean user interface with signature "Blu. Archive" bold and italic typography.
* **External Player Support**: Open videos directly in Windows' built-in media player (VLC, Media Player, etc.).

## 🚀 Technologies Used
* Backend: Go (Golang)
* Frontend: React.js & CSS3
* Database: SQLite (via `modernc.org/sqlite`)
* Tools: FFmpeg & FFprobe (Embedded)

## 🛠️ Installation (Development)

### Prerequisites
1. **Go** (Version 1.18+)
2. **Node.js** & **NPM**
3. **Wails CLI** (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Steps
1. Clone this repository:
```go
git clone [https://github.com/your-username/blu-archive.git](https://github.com/your-username/blu-archive.git)
cd blu-archive
```
2. Make sure the `ffmpeg.exe` and `ffprobe.exe` files are in the `bin/` folder for embedding.
3. Run the application in development mode:
```go
wails dev
```
4. To build the final `.exe` file:
```bash
wails build -clean
```

---
Built with ❤️ by **Rumix Tools**
