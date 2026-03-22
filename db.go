package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	_ "modernc.org/sqlite"
)

var db *sql.DB

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
		video_path TEXT,
		duration TEXT DEFAULT '00:00',
		artist TEXT DEFAULT '',
		description TEXT DEFAULT '',
		release_year TEXT DEFAULT '',
		screenshot_path TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := db.Exec(createTableQuery); err != nil {
		fmt.Println("Gagal membuat tabel:", err)
	}
	addColumnSafely := func(columnName string) {
		query := fmt.Sprintf("ALTER TABLE videos ADD COLUMN %s TEXT DEFAULT ''", columnName)
		_, _ = db.Exec(query)
	}

	addColumnSafely("artist")
	addColumnSafely("description")
	addColumnSafely("release_year")
	addColumnSafely("screenshot_path")
}

func (a *App) GetVideos() ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database belum siap")
	}

	rows, err := db.Query("SELECT id, title, cover_path, video_path, duration, artist, description, release_year, screenshot_path FROM videos ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []map[string]interface{}
	for rows.Next() {
		var id int
		var title, coverPath, videoPath, duration, artist, description, releaseYear, screenshotPath string
		err := rows.Scan(&id, &title, &coverPath, &videoPath, &duration, &artist, &description, &releaseYear, &screenshotPath)
		if err != nil {
			return nil, err
		}

		videos = append(videos, map[string]interface{}{
			"id":             id,
			"title":          title,
			"coverPath":      coverPath,
			"videoPath":      videoPath,
			"duration":       duration,
			"artist":         artist,
			"description":    description,
			"releaseYear":    releaseYear,
			"screenshotPath": screenshotPath,
		})
	}
	return videos, nil
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
	}
	query := `UPDATE videos SET title=?, artist=?, release_year=?, description=?, screenshot_path=?, cover_path=?, video_path=? WHERE id=?`
	_, err = db.Exec(query, title, artist, releaseYear, description, finalScreenshot, finalCover, finalVideo, id)

	return err
}
func (a *App) UpdateScreenshotPath(id int, path string) error {
	query := `UPDATE videos SET screenshot_path=? WHERE id=?`
	_, err := db.Exec(query, path, id)
	return err
}
