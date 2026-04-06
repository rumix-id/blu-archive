# 🎬 BLU. ARCHIVE - Video Manager

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Wails](https://img.shields.io/badge/built%20with-Wails%20v2-red)
![Go](https://img.shields.io/badge/backend-Go-00ADD8?logo=go)
![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react)
![Flying Chess Demo](screenshots/programs.gif)
**BLU. ARCHIVE** is a personal video gallery management desktop application built using **Wails v2**, **Go**, and **React**. This application allows you to manage your local video collection with a modern interface minimalist.

## ✨ Key Features
* **Auto Thumbnail Generation**: Automatically capture screenshots from videos using FFmpeg.
* **Metadata Editor**: Directly edit video titles, artists, release years, and descriptions.
* **Safe File Renaming**: Intelligently renames physical files safely without overwriting other data.
* **Integrated Database**: Uses SQLite for fast and portable data storage.
* **External Player Support**: Open videos directly in Windows' built-in media player (VLC, Media Player, etc.).

## 🚀 Technologies Used
* Backend: Go (Golang)
* Frontend: React.js & CSS3
* Database: SQLite (via `modernc.org/sqlite`)
* Tools: FFmpeg & FFprobe (Embedded)


## 📂 Program Structure Explanation
You can manually add files to the **Episode** or **movie** folder without opening the program.
```
├── blu-archive.exe             # Main application file from the build (adjust to the original name)
├── data.db                     # SQLite database for storing video, episode, and duration lists
├── bin/                        # External tool folder
│ ├── ffmpeg.exe                # FFmpeg for video processing
│ ├── ffprobe.exe               # FFprobe for duration checking
├── movie/                      # Storage folder for individual videos or movies
│ ├── single film_01.mp4        # Physical file of imported videos
│ ├── single film_02.mkv
├── Episode/                    # Parent folder for movie series (Movie Season)
│ ├── [Season 1 Name]/          # Example: "Naruto S1" (Contains a collection of episode files)
│ ├── [Season 2 Name]/          # Example: "One Piece"
├── cover/                      # Folder for images
│ ├── cover_video_1.jpg         # ffmpeg extracted image
│ ├── cover_video_2.jpg         # Image displayed as a card in the app
```
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

## 📂 blu-archive
```
├── bin/                   # Binary file location to embed
│ ├── ffmpeg.exe           # FFmpeg for video processing
│ ├── ffprobe.exe          # FFprobe for duration checking
├── build/
│ ├── bin/
│ │ ├── blu-archive.exe    # Your main application
│ └── windows/             # Windows icons and manifest
├── frontend/
│ ├── src/
│ │ ├── assets/            # Logo and Fonts
│ │ │ └── fonts/           # nunito-v16-latin-regular.woff2 file
│ │ ├── App.tsx            # Main React components
│ │ ├── App.css            # CSS Styling (Title Bold Italic, etc.)
│ │ └── main.tsx           # React entry point
│ ├── dist/
│ ├── package.json         # Node.js dependencies
│ └── vite.config.ts       # Vite configuration
├── app.go                 # Wails main logic (Startup, Bindings)
├── db.go                  # Database & File Management Logic
├── main.go                # Go application entry point (Setup Wails)
├── go.mod                 # Go Dependencies
├── wails.json             # Wails project configuration
├── .gitignore             # List of disallowed files uploaded
└── README.md              # Project documentation
```
---
Built with ❤️ by **Rumix Tools**
