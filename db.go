package main

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"syscall"

	_ "modernc.org/sqlite"
)

var (
	db        *sql.DB
	scanMutex sync.Mutex
)

func initDB() {
	ex, err := os.Executable()
	if err != nil {
		fmt.Println("Gagal mendapatkan path executable:", err)
		return
	}
	exPath := filepath.Dir(ex)
	dbPath := filepath.Join(exPath, "data.db")

	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Println("Gagal membuka database:", err)
		return
	}
	createTableQuery := `
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        cover_path TEXT,
        video_path TEXT UNIQUE, 
        duration TEXT DEFAULT '00:00',
        artist TEXT DEFAULT '',
        description TEXT DEFAULT '',
        release_year TEXT DEFAULT '',
        screenshot_path TEXT DEFAULT '',
        is_favorite INTEGER DEFAULT 0,
        is_group INTEGER DEFAULT 0,
        last_played_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
	_, _ = db.Exec(createTableQuery)
	_, _ = db.Exec("UPDATE videos SET video_path = REPLACE(video_path, '\\', '/')")
	_, _ = db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_video_path ON videos(video_path)")
	addColumnSafely := func(columnName string, columnType string) {
		query := fmt.Sprintf("ALTER TABLE videos ADD COLUMN %s %s", columnName, columnType)
		_, _ = db.Exec(query)
	}
	addColumnSafely("artist", "TEXT DEFAULT ''")
	addColumnSafely("description", "TEXT DEFAULT ''")
	addColumnSafely("release_year", "TEXT DEFAULT ''")
	addColumnSafely("screenshot_path", "TEXT DEFAULT ''")
	addColumnSafely("last_played_at", "DATETIME")
	addColumnSafely("is_favorite", "INTEGER DEFAULT 0")
	addColumnSafely("is_group", "INTEGER DEFAULT 0")
	cleanQuery := `
        DELETE FROM videos 
        WHERE id NOT IN (
            SELECT MIN(id) 
            FROM videos 
            GROUP BY video_path
        );`
	_, _ = db.Exec(cleanQuery)

	if err := db.Ping(); err != nil {
		fmt.Println("Database tidak merespon:", err)
	}
}

func (a *App) SaveVideoEdit(id int, title string, artist string, releaseYear string, description string, screenshotPath string) error {
	var oldTitle, oldCover, oldVideo, oldScreenshot string
	err := db.QueryRow("SELECT title, cover_path, video_path, screenshot_path FROM videos WHERE id = ?", id).Scan(&oldTitle, &oldCover, &oldVideo, &oldScreenshot)
	if err != nil {
		return err
	}
	reg, _ := regexp.Compile(`[\\/:*?"<>|]`)
	newTitleClean := reg.ReplaceAllString(strings.ReplaceAll(title, " ", "_"), "")
	newFileNameBase := fmt.Sprintf("%d_%s", id, newTitleClean)
	finalCover := oldCover
	finalVideo := oldVideo
	finalScreenshot := oldScreenshot
	if screenshotPath != "" && screenshotPath != oldScreenshot {
		if !strings.Contains(filepath.ToSlash(screenshotPath), "movie/screenshots") {
			screenshotDir := filepath.Join("movie", "screenshots")
			os.MkdirAll(screenshotDir, os.ModePerm)

			src, err := os.Open(screenshotPath)
			if err == nil {
				ext := filepath.Ext(screenshotPath)
				destName := fmt.Sprintf("%s_screenshot%s", newFileNameBase, ext)
				destPath := filepath.Join(screenshotDir, destName)

				dst, err := os.Create(destPath)
				if err == nil {
					io.Copy(dst, src)
					dst.Close()
					finalScreenshot = "/" + filepath.ToSlash(destPath)
				}
				src.Close()
			}
		}
	}
	if title != oldTitle {
		if oldVideo != "" {
			oldPath := filepath.Clean(strings.TrimPrefix(oldVideo, "/"))
			ext := filepath.Ext(oldPath)
			newPath := filepath.Join("movie", newFileNameBase+ext)

			if _, err := os.Stat(oldPath); err == nil {
				if err := os.Rename(oldPath, newPath); err == nil {
					finalVideo = "/" + filepath.ToSlash(newPath)
				}
			}
		}
		if oldCover != "" && !strings.Contains(oldCover, "default-cover.jpg") {
			oldPath := filepath.Clean(strings.TrimPrefix(oldCover, "/"))
			ext := filepath.Ext(oldPath)
			newPath := filepath.Join("cover", newFileNameBase+ext)

			if _, err := os.Stat(oldPath); err == nil {
				if err := os.Rename(oldPath, newPath); err == nil {
					finalCover = "/" + filepath.ToSlash(newPath)
				}
			}
		}
		if finalScreenshot != "" {
			oldPath := filepath.Clean(strings.TrimPrefix(finalScreenshot, "/"))
			ext := filepath.Ext(oldPath)
			newPath := filepath.Join("movie", "screenshots", newFileNameBase+"_screenshot"+ext)

			if _, err := os.Stat(oldPath); err == nil {
				if err := os.Rename(oldPath, newPath); err == nil {
					finalScreenshot = "/" + filepath.ToSlash(newPath)
				}
			}
		}
	}
	query := `UPDATE videos SET title=?, artist=?, release_year=?, description=?, screenshot_path=?, cover_path=?, video_path=? WHERE id=?`
	_, err = db.Exec(query, title, artist, releaseYear, description, finalScreenshot, finalCover, finalVideo, id)

	return err
}

func (a *App) AutoScanFolder() (int, error) {
	movieDir := "movie"
	files, err := os.ReadDir(movieDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	newCount := 0
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(file.Name()))
		if ext != ".mp4" && ext != ".mkv" && ext != ".avi" && ext != ".mov" {
			continue
		}

		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM videos WHERE video_path LIKE ?", "%"+file.Name()).Scan(&count)
		if err != nil || count > 0 {
			continue
		}

		videoPath := filepath.Join(movieDir, file.Name())
		dbPath := "/" + filepath.ToSlash(videoPath)
		title := strings.TrimSuffix(file.Name(), ext)
		duration := a.GetDuration(videoPath)
		reg, _ := regexp.Compile(`[\\/:*?"<>|]`)
		cleanTitle := reg.ReplaceAllString(strings.ReplaceAll(title, " ", "_"), "")
		coverFileName := cleanTitle + ".jpg"
		coverFilePath := filepath.Join("cover", coverFileName)
		dbCoverPath := "/" + filepath.ToSlash(coverFilePath)
		os.MkdirAll("cover", os.ModePerm)
		ffmpegPath := filepath.Join("bin", "ffmpeg")
		if runtime.GOOS == "windows" {
			ffmpegPath += ".exe"
		}

		cmd := exec.Command(ffmpegPath, "-y", "-i", videoPath, "-ss", "00:00:02.000", "-vframes", "1", coverFilePath)
		if runtime.GOOS == "windows" {
			cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		}
		_ = cmd.Run()
		if _, err := os.Stat(coverFilePath); err != nil {
			dbCoverPath = "/cover/default-cover.jpg"
		}
		query := `INSERT INTO videos (title, cover_path, video_path, duration, artist, description, release_year, screenshot_path, is_group) 
          VALUES (?, ?, ?, ?, '', '', '', '', 0)`

		_, err = db.Exec(query, title, dbCoverPath, dbPath, duration)
		if err == nil {
			newCount++
		}
	}

	return newCount, nil
}

func (a *App) UpdateScreenshotPath(id int, path string) error {
	query := `UPDATE videos SET screenshot_path=? WHERE id=?`
	_, err := db.Exec(query, path, id)
	return err
}

func (a *App) GetVideoCount() (int, error) {
	if db == nil {
		return 0, nil
	}

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM videos").Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (a *App) CheckTitleExists(title string, excludeID int) (bool, error) {
	var exists bool
	query := "SELECT EXISTS(SELECT 1 FROM videos WHERE title = ? AND id != ?)"
	err := db.QueryRow(query, title, excludeID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}
