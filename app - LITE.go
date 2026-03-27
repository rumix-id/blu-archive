package main

import (
	"context"
	_ "embed"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//#######################################################################
// AKTIFKAN FUNGSI DIBAWAH JIKA INGIN INCLUDE FOLDER BIN YANG BERISI
//#######################################################################

// //go:embed bin/ffprobe.exe
// var embeddedFFprobe []byte

// //go:embed bin/ffmpeg.exe
// var embeddedFFmpeg []byte

//#######################################################################

type Video struct {
	ID             int    `json:"id"`
	Title          string `json:"title"`
	CoverPath      string `json:"coverPath"`
	VideoPath      string `json:"videoPath"`
	Duration       string `json:"duration"`
	Artist         string `json:"artist"`
	Description    string `json:"description"`
	ReleaseYear    string `json:"releaseYear"`
	ScreenshotPath string `json:"screenshotPath"`
	IsFavorite     bool   `json:"is_favorite"`
	LastPlayedAt   string `json:"last_played_at"`
	IsGroup        int    `json:"is_group"`
}

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) SelectFolder() (string, error) {
	selection, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Screenshot Image",
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "Images (*.png;*.jpg;*.jpeg;*.webp)",
				Pattern:     "*.png;*.jpg;*.jpeg;*.webp",
			},
		},
	})

	if err != nil {
		return "", err
	}

	return selection, nil
}

func (a *App) OpenFolder(path string) error {
	if path == "" {
		return fmt.Errorf("file tidak ditemukan")
	}

	cleanPath := filepath.Clean(path)

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":

		cmd = exec.Command("cmd", "/c", "start", "", cleanPath)
	case "darwin":
		cmd = exec.Command("open", cleanPath)
	default:
		cmd = exec.Command("xdg-open", cleanPath)
	}
	return cmd.Start()
}

//#######################################################################
// AKTIFKAN FUNGSI DIBAWAH JIKA INGIN TANPA INCLUDE FOLDER BIN
//#######################################################################

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	initDB()
	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)
	os.Chdir(exPath)
	os.MkdirAll("movie", 0755)
	os.MkdirAll("cover", 0755)
	os.MkdirAll("bin", 0755)
	os.MkdirAll("Episode", 0755)

}

//#######################################################################
// AKTIFKAN FUNGSI DIBAWAH JIKA INGIN INCLUDE FOLDER BIN YANG BERISI
// ffprobe.exe dan ffmpeg.exe
//#######################################################################
// func (a *App) startup(ctx context.Context) {
// 	a.ctx = ctx
// 	initDB()
// 	ex, _ := os.Executable()
// 	exPath := filepath.Dir(ex)
// 	os.Chdir(exPath)

// 	os.MkdirAll("movie", 0755)
// 	os.MkdirAll("cover", 0755)
// 	os.MkdirAll("bin", 0755)
// 	os.MkdirAll("Episode", 0755)

//		if runtime.GOOS == "windows" {
//			ffprobePath := filepath.Join("bin", "ffprobe.exe")
//			if _, err := os.Stat(ffprobePath); os.IsNotExist(err) {
//				_ = os.WriteFile(ffprobePath, embeddedFFprobe, 0755)
//			}
//			ffmpegPath := filepath.Join("bin", "ffmpeg.exe")
//			if _, err := os.Stat(ffmpegPath); os.IsNotExist(err) {
//				if len(embeddedFFmpeg) > 0 {
//					_ = os.WriteFile(ffmpegPath, embeddedFFmpeg, 0755)
//				}
//			}
//		}
//	}
func getDurationWithFFmpeg(ffmpegPath, videoPath string) string {
	cmd := exec.Command(ffmpegPath, "-i", videoPath)
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}
	out, _ := cmd.CombinedOutput()
	re := regexp.MustCompile(`Duration:\s(\d{2}:\d{2}:\d{2})`)
	match := re.FindStringSubmatch(string(out))
	if len(match) > 1 {
		parts := strings.Split(match[1], ":")
		if parts[0] == "00" {
			return parts[1] + ":" + parts[2]
		}
		return match[1]
	}
	return "00:00"
}

func (a *App) ChangeCover(videoID int) error {
	filePath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Pilih Gambar Cover",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Images", Pattern: "*.jpg;*.jpeg;*.png;*.webp"},
		},
	})

	if err != nil || filePath == "" {
		return err
	}

	ext := filepath.Ext(filePath)
	newCoverName := fmt.Sprintf("cover_%d%s", videoID, ext)
	newCoverPath := filepath.Join("cover", newCoverName)

	src, _ := os.Open(filePath)
	defer src.Close()
	dst, _ := os.Create(newCoverPath)
	defer dst.Close()
	io.Copy(dst, src)

	dbPath := "/cover/" + newCoverName
	_, err = db.Exec("UPDATE videos SET cover_path = ? WHERE id = ?", dbPath, videoID)

	return err
}

func (a *App) UpdateVideoData(id int, title, artist, description, releaseYear string) error {
	query := `UPDATE videos SET title = ?, artist = ?, description = ?, release_year = ? WHERE id = ?`
	_, err := db.Exec(query, title, artist, description, releaseYear, id)
	return err
}
func extractThumbnail(ffmpegPath, videoPath, coverPath string) error {
	cmd := exec.Command(ffmpegPath, "-i", videoPath, "-ss", "00:00:02.000", "-vframes", "1", coverPath)
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}
	return cmd.Run()
}

func formatDuration(rawDuration string) string {
	parts := strings.Split(rawDuration, ":")
	if len(parts) != 3 {
		return rawDuration
	}

	hours := parts[0]
	minutes := parts[1]
	seconds := parts[2]
	if hours == "00" {
		return fmt.Sprintf("%s:%s", minutes, seconds)
	}
	return rawDuration
}

func (a *App) ImportVideo() error {
	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)

	filePath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title:   "Select Video",
		Filters: []wailsRuntime.FileFilter{{DisplayName: "Videos", Pattern: "*.mp4;*.mkv;*.avi"}},
	})
	if err != nil || filePath == "" {
		return err
	}
	movieDir := filepath.Join(exPath, "movie")
	coverDir := filepath.Join(exPath, "cover")
	os.MkdirAll(movieDir, 0755)
	os.MkdirAll(coverDir, 0755)

	fileName := filepath.Base(filePath)
	destPathAbs := filepath.Join(movieDir, fileName)

	src, _ := os.Open(filePath)
	defer src.Close()
	dst, _ := os.Create(destPathAbs)
	defer dst.Close()
	io.Copy(dst, src)
	dst.Sync()
	videoDbPath := "/movie/" + fileName
	coverDbPath := "/cover/default-cover.jpg"
	duration := "00:00"
	ffmpeg := filepath.Join(exPath, "bin", "ffmpeg.exe")
	if _, err := os.Stat(ffmpeg); err == nil {
		cmd := exec.Command(ffmpeg, "-i", destPathAbs)
		if runtime.GOOS == "windows" {
			cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		}
		out, _ := cmd.CombinedOutput()
		re := regexp.MustCompile(`Duration:\s(\d{2}:\d{2}:\d{2})`)
		m := re.FindStringSubmatch(string(out))
		if len(m) > 1 {
			duration = m[1]
		}
		cleanTitle := strings.TrimSuffix(fileName, filepath.Ext(fileName))
		thumbName := cleanTitle + ".jpg"
		thumbFullPath := filepath.Join(coverDir, thumbName)
		if err := a.extractThumbnail(ffmpeg, destPathAbs, thumbFullPath); err == nil {
			coverDbPath = "/cover/" + thumbName
		}
	}

	_, err = db.Exec("INSERT INTO videos (title, cover_path, video_path, duration) VALUES (?, ?, ?, ?)",
		fileName, coverDbPath, videoDbPath, duration)

	return err
}

func (a *App) extractThumbnail(ffmpegPath string, videoPath string, destPath string) error {
	cmd := exec.Command(ffmpegPath, "-i", videoPath, "-ss", "00:00:05", "-vframes", "1", "-q:v", "2", destPath, "-y")

	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}

	return cmd.Run()
}
func (a *App) RenameVideo(id int, oldVideoPath string, newTitle string, newArtist string) error {
	var oldArtist, desc, year, oldCoverPath, oldScreenshotPath string
	var isGroup int
	err := db.QueryRow("SELECT artist, description, release_year, cover_path, screenshot_path, is_group FROM videos WHERE id = ?", id).
		Scan(&oldArtist, &desc, &year, &oldCoverPath, &oldScreenshotPath, &isGroup)
	if err != nil {
		return err
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM videos WHERE title = ? AND id != ?", newTitle, id).Scan(&count)
	if count > 0 {
		return fmt.Errorf("Title '%s' already exists in your collection.", newTitle)
	}
	newTitleClean := strings.ReplaceAll(newTitle, " ", "_")
	reg, _ := regexp.Compile(`[\\/:*?"<>|]`)
	newTitleClean = reg.ReplaceAllString(newTitleClean, "")

	finalVideo := oldVideoPath
	finalCover := oldCoverPath
	finalScreenshot := oldScreenshotPath
	if isGroup == 1 {
		oldFolder := filepath.Join(".", strings.TrimPrefix(oldVideoPath, "/"))
		newFolder := filepath.Join("Episode", newTitleClean)

		if oldFolder != newFolder {
			if _, err := os.Stat(oldFolder); err == nil {
				if err := os.Rename(oldFolder, newFolder); err == nil {
					finalVideo = "Episode/" + newTitleClean
					newPathForDb := "Episode/" + newTitleClean
					_, _ = db.Exec("UPDATE videos SET video_path = REPLACE(video_path, ?, ?) WHERE video_path LIKE ?",
						oldVideoPath, newPathForDb, oldVideoPath+"/%")
				}
			}
		}
	} else {
		if oldVideoPath != "" {
			cleanOldVideo := filepath.Join(".", strings.TrimPrefix(oldVideoPath, "/"))
			extVideo := filepath.Ext(cleanOldVideo)
			newVideoFullPath := filepath.Join("movie", newTitleClean+extVideo)
			if cleanOldVideo != newVideoFullPath {
				if err := os.Rename(cleanOldVideo, newVideoFullPath); err == nil {
					finalVideo = "/" + filepath.ToSlash(newVideoFullPath)
				}
			}
		}
	}
	if oldCoverPath != "" && !strings.Contains(oldCoverPath, "default-cover.jpg") {
		cleanOldCover := filepath.Join(".", strings.TrimPrefix(oldCoverPath, "/"))
		extCover := filepath.Ext(cleanOldCover)
		newCoverFullPath := filepath.Join("cover", newTitleClean+extCover)

		if cleanOldCover != newCoverFullPath {
			if err := os.Rename(cleanOldCover, newCoverFullPath); err == nil {
				finalCover = "/cover/" + newTitleClean + extCover
			}
		}
	}
	query := `UPDATE videos SET title=?, artist=?, release_year=?, description=?, screenshot_path=?, cover_path=?, video_path=? WHERE id=?`
	_, err = db.Exec(query, newTitle, newArtist, year, desc, finalScreenshot, finalCover, finalVideo, id)

	return err
}
func (a *App) UpdateArtist(id int, artist string) error {
	var title, desc, year string
	_ = db.QueryRow("SELECT title, description, release_year FROM videos WHERE id = ?", id).Scan(&title, &desc, &year)
	return a.UpdateVideoData(id, title, artist, desc, year)
}

func (a *App) DeleteVideo(videoID int, videoPath string, coverPath string) error {
	var isGroup int
	err := db.QueryRow("SELECT is_group FROM videos WHERE id = ?", videoID).Scan(&isGroup)
	if err != nil {
		return err
	}

	actualPath := filepath.Clean(videoPath)

	if isGroup == 1 {
		if _, err := os.Stat(actualPath); err == nil {
			err = os.RemoveAll(actualPath)
			if err != nil {
				fmt.Println("Gagal hapus folder fisik:", err)
			}
		}
		_, _ = db.Exec("DELETE FROM videos WHERE video_path LIKE ?", videoPath+"%")
	} else {
		if _, err := os.Stat(actualPath); err == nil {
			_ = os.Remove(actualPath)
		}
	}
	if coverPath != "" && !strings.Contains(coverPath, "default-cover.jpg") {
		_ = os.Remove(filepath.Join(".", strings.TrimPrefix(coverPath, "/")))
	}
	_, err = db.Exec("DELETE FROM videos WHERE id = ?", videoID)
	return err
}

func (a *App) UpdateCover(videoID int, base64Image string, videoTitle string) error {

	os.MkdirAll("cover", 0755)

	cleanTitle := strings.ReplaceAll(videoTitle, " ", "_")
	reg, _ := regexp.Compile(`[\\/:*?"<>|]`)
	cleanTitle = reg.ReplaceAllString(cleanTitle, "")

	fileName := cleanTitle + "_custom.jpg"
	filePath := filepath.Join("cover", fileName)

	parts := strings.Split(base64Image, ",")
	rawBase64 := base64Image
	if len(parts) > 1 {
		rawBase64 = parts[1]
	}

	data, err := base64.StdEncoding.DecodeString(rawBase64)
	if err != nil {
		return err
	}

	err = os.WriteFile(filePath, data, 0644)
	if err != nil {
		return err
	}

	dbPath := "/cover/" + fileName
	_, err = db.Exec("UPDATE videos SET cover_path = ? WHERE id = ?", dbPath, videoID)

	return err
}

func (a *App) OpenVideo(videoPath string) {
	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)
	cleanVirtualPath := strings.TrimPrefix(videoPath, "/")
	var finalPath string
	if filepath.IsAbs(cleanVirtualPath) {
		finalPath = filepath.Clean(cleanVirtualPath)
	} else {
		finalPath = filepath.Join(exPath, filepath.FromSlash(cleanVirtualPath))
	}
	fmt.Printf("Mencoba membuka: %s\n", finalPath)
	if _, err := os.Stat(finalPath); os.IsNotExist(err) {
		fmt.Printf("Gagal: File tidak ditemukan di %s\n", finalPath)
		return
	}

	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", finalPath)
	} else if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", finalPath)
	} else {
		cmd = exec.Command("xdg-open", finalPath)
	}

	err := cmd.Run()
	if err != nil {
		fmt.Printf("Gagal membuka video: %v\n", err)
	}
}

func (a *App) UpdateVideoLocation(videoID int) (string, error) {
	var oldVideoPath string
	_ = db.QueryRow("SELECT video_path FROM videos WHERE id = ?", videoID).Scan(&oldVideoPath)

	newPath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select New Video Path",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Video Files", Pattern: "*.mp4;*.mkv;*.avi;*.mov"},
		},
	})

	if err != nil {
		return "", err
	}
	if newPath == "" {
		return "", fmt.Errorf("batal memilih file")
	}

	os.MkdirAll("movie", 0755)

	fileName := filepath.Base(newPath)
	destPath := filepath.Join("movie", fileName)
	absNewPath, _ := filepath.Abs(newPath)
	absDestPath, _ := filepath.Abs(destPath)
	if strings.EqualFold(absNewPath, absDestPath) {
		fmt.Println("File sudah berada di folder tujuan, skip copy agar tidak korup.")
	} else {
		src, err := os.Open(newPath)
		if err != nil {
			return "", fmt.Errorf("gagal membuka file sumber: %v", err)
		}
		defer src.Close()

		dst, err := os.Create(destPath)
		if err != nil {
			return "", fmt.Errorf("gagal membuat file tujuan: %v", err)
		}
		defer dst.Close()

		_, err = io.Copy(dst, src)
		if err != nil {
			return "", fmt.Errorf("gagal menyalin file: %v", err)
		}
	}
	if oldVideoPath != "" {
		oldPathClean := filepath.Clean(strings.TrimPrefix(oldVideoPath, "/"))
		absOldPath, _ := filepath.Abs(oldPathClean)
		if !strings.EqualFold(absOldPath, absDestPath) {
			if _, err := os.Stat(oldPathClean); err == nil {
				bakPath := oldPathClean + ".bak"
				os.Remove(bakPath)
				os.Rename(oldPathClean, bakPath)
			}
		}
	}
	dbPath := destPath
	if !strings.HasPrefix(dbPath, "/") {
		dbPath = "/" + filepath.ToSlash(destPath)
	}

	newDuration := a.GetDuration(destPath)

	query := "UPDATE videos SET video_path = ?, duration = ? WHERE id = ?"
	_, err = db.Exec(query, dbPath, newDuration, videoID)
	if err != nil {
		return "", err
	}

	return newDuration, nil
}

func (a *App) GetDuration(videoPath string) string {
	ffprobePath := filepath.Join("bin", "ffprobe")
	if runtime.GOOS == "windows" {
		ffprobePath += ".exe"
	}

	cmd := exec.Command(ffprobePath, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath)

	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}

	output, err := cmd.Output()
	if err != nil {
		fmt.Println("Gagal membaca durasi:", err)
		return "00:00"
	}
	durationStr := strings.TrimSpace(string(output))
	durationSec, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return "00:00"
	}
	hours := int(durationSec) / 3600
	minutes := (int(durationSec) % 3600) / 60
	seconds := int(durationSec) % 60

	if hours > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	}
	return fmt.Sprintf("%02d:%02d", minutes, seconds)
}
func (a *App) GetLastPlayedVideos() ([]Video, error) {
	query := `SELECT id, title, cover_path, video_path, duration, artist, description, release_year, screenshot_path, is_favorite, last_played_at 
			  FROM videos 
			  WHERE last_played_at != '' 
			  ORDER BY last_played_at DESC`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []Video
	for rows.Next() {
		var v Video
		err := rows.Scan(&v.ID, &v.Title, &v.CoverPath, &v.VideoPath, &v.Duration, &v.Artist, &v.Description, &v.ReleaseYear, &v.ScreenshotPath, &v.IsFavorite, &v.LastPlayedAt)
		if err == nil {
			videos = append(videos, v)
		}
	}
	return videos, nil
}
func (a *App) GetFavoriteVideos() ([]Video, error) {
	query := `SELECT id, 
	                 title, 
	                 COALESCE(cover_path, ''), 
	                 COALESCE(video_path, ''), 
	                 COALESCE(duration, '00:00:00'), 
	                 COALESCE(artist, ''), 
	                 COALESCE(description, ''), 
	                 COALESCE(release_year, ''), 
	                 COALESCE(screenshot_path, ''), 
	                 is_favorite, 
	                 COALESCE(last_played_at, ''),
	                 is_group
	          FROM videos 
	          WHERE is_favorite = 1 
	          ORDER BY title ASC`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []Video
	for rows.Next() {
		var v Video
		err := rows.Scan(
			&v.ID,
			&v.Title,
			&v.CoverPath,
			&v.VideoPath,
			&v.Duration,
			&v.Artist,
			&v.Description,
			&v.ReleaseYear,
			&v.ScreenshotPath,
			&v.IsFavorite,
			&v.LastPlayedAt,
			&v.IsGroup,
		)

		if err == nil {
			videos = append(videos, v)
		} else {
			fmt.Println("Gagal scan video di Favorite:", err)
		}
	}
	return videos, nil
}
func (a *App) ToggleFavorite(id int) error {
	var currentStatus int
	err := db.QueryRow("SELECT is_favorite FROM videos WHERE id = ?", id).Scan(&currentStatus)
	if err != nil {
		return err
	}
	newStatus := 0
	if currentStatus == 0 {
		newStatus = 1
	}

	_, err = db.Exec("UPDATE videos SET is_favorite = ? WHERE id = ?", newStatus, id)
	return err
}
func (a *App) GetVideos() ([]Video, error) {
	query := `SELECT 
				id, 
				title, 
				IFNULL(cover_path, ''), 
				video_path, 
				duration, 
				artist, 
				description, 
				release_year, 
				screenshot_path, 
				is_favorite, 
				IFNULL(last_played_at, ''), 
				is_group 
			  FROM videos 
			  ORDER BY id DESC`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []Video
	for rows.Next() {
		var v Video
		err := rows.Scan(
			&v.ID,
			&v.Title,
			&v.CoverPath,
			&v.VideoPath,
			&v.Duration,
			&v.Artist,
			&v.Description,
			&v.ReleaseYear,
			&v.ScreenshotPath,
			&v.IsFavorite,
			&v.LastPlayedAt,
			&v.IsGroup,
		)
		if err == nil {
			videos = append(videos, v)
		} else {
			fmt.Println("Error saat scan video:", err)
		}
	}
	return videos, nil
}

func (a *App) MarkAsPlayed(id int) error {
	currentTime := time.Now().Format("2006-01-02 15:04:05")
	query := "UPDATE videos SET last_played_at = ? WHERE id = ?"
	_, err := db.Exec(query, currentTime, id)

	if err != nil {
		return err
	}
	return nil
}

func (a *App) ClearPlaybackHistory() error {
	query := "UPDATE videos SET last_played_at = ''"

	_, err := db.Exec(query)
	if err != nil {
		return err
	}

	return nil
}

func (a *App) MoveToEpisodeFolder() error {
	sourcePath, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select a folder that contains many movies.",
	})
	if err != nil || sourcePath == "" {
		return err
	}
	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)
	episodeBaseDir := filepath.Join(exPath, "Episode")
	coverBaseDir := filepath.Join(exPath, "cover")
	ffmpegPath := filepath.Join(exPath, "bin", "ffmpeg.exe")
	ffprobePath := filepath.Join(exPath, "bin", "ffprobe.exe")

	os.MkdirAll(episodeBaseDir, 0755)
	os.MkdirAll(coverBaseDir, 0755)

	folderName := filepath.Base(sourcePath)
	targetPath := filepath.Join(episodeBaseDir, folderName)
	err = os.Rename(sourcePath, targetPath)
	if err != nil {
		return fmt.Errorf("Gagal pindah folder: %v", err)
	}
	files, _ := os.ReadDir(targetPath)
	var firstVideoRel string
	var groupCoverPath string

	for _, f := range files {
		if !f.IsDir() && isVideoFile(f.Name()) {
			videoFileAbs := filepath.Join(targetPath, f.Name())
			videoFileRel := filepath.ToSlash(filepath.Join("Episode", folderName, f.Name()))
			durationStr := "00:00:00"
			cmdProbe := exec.Command(ffprobePath, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "-sexagesimal", videoFileAbs)
			cmdProbe.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
			out, err := cmdProbe.Output()

			if err == nil {
				rawDuration := strings.TrimSpace(string(out))
				if len(rawDuration) >= 8 {
					durationStr = rawDuration[:8]
				}
			}
			thumbName := strings.TrimSuffix(f.Name(), filepath.Ext(f.Name())) + ".jpg"
			thumbDest := filepath.Join(coverBaseDir, thumbName)
			dbCoverPath := "/cover/" + thumbName

			cmd := exec.Command(ffmpegPath, "-y", "-i", videoFileAbs, "-ss", "00:00:02.000", "-vframes", "1", thumbDest)
			cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
			_ = cmd.Run()
			queryEp := `INSERT INTO videos (title, video_path, cover_path, duration, is_group) 
                        VALUES (?, ?, ?, ?, 0)`
			_, err = db.Exec(queryEp, f.Name(), videoFileRel, dbCoverPath, durationStr)

			if firstVideoRel == "" {
				firstVideoRel = videoFileRel
				groupCoverPath = dbCoverPath
			}
		}
	}
	if firstVideoRel != "" {
		groupPathRel := filepath.ToSlash(filepath.Join("Episode", folderName))
		queryGroup := `INSERT OR IGNORE INTO videos (title, video_path, cover_path, is_group) 
                       VALUES (?, ?, ?, 1)`
		_, _ = db.Exec(queryGroup, folderName, groupPathRel, groupCoverPath)
	}

	return nil
}

func isVideoFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return ext == ".mp4" || ext == ".mkv" || ext == ".avi" || ext == ".mov"
}

func (a *App) AutoScanEpisodes() error {
	scanMutex.Lock()
	defer scanMutex.Unlock()
	if db == nil {
		return nil
	}

	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)
	episodeBaseDir := filepath.Join(exPath, "Episode")
	coverBaseDir := filepath.Join(exPath, "cover")
	ffprobePath := filepath.Join(exPath, "bin", "ffprobe.exe")
	ffmpegPath := filepath.Join(exPath, "bin", "ffmpeg.exe")

	os.MkdirAll(episodeBaseDir, 0755)
	os.MkdirAll(coverBaseDir, 0755)

	folders, err := os.ReadDir(episodeBaseDir)
	if err != nil {
		return err
	}

	for _, f := range folders {
		if f.IsDir() {
			folderName := f.Name()
			folderPathRel := filepath.ToSlash(filepath.Join("Episode", folderName))
			targetPathAbs := filepath.Join(episodeBaseDir, folderName)
			var count int
			_ = db.QueryRow("SELECT COUNT(*) FROM videos WHERE video_path = ?", folderPathRel).Scan(&count)
			groupExists := (count > 0)

			files, _ := os.ReadDir(targetPathAbs)
			var firstThumb string
			for _, file := range files {
				if !file.IsDir() && isVideoFile(file.Name()) {
					videoFileAbs := filepath.Join(targetPathAbs, file.Name())
					videoFileRel := filepath.ToSlash(filepath.Join(folderPathRel, file.Name()))

					var videoExists int
					db.QueryRow("SELECT COUNT(*) FROM videos WHERE video_path = ?", videoFileRel).Scan(&videoExists)

					if videoExists == 0 {
						durationStr := "00:00:00"
						cmdProbe := exec.Command(ffprobePath, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "-sexagesimal", videoFileAbs)
						cmdProbe.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
						out, err := cmdProbe.Output()

						if err == nil {
							raw := strings.TrimSpace(string(out))
							if len(raw) >= 8 {
								durationStr = raw[:8]
							}
						}

						thumbName := strings.TrimSuffix(file.Name(), filepath.Ext(file.Name())) + "_" + fmt.Sprint(time.Now().Unix()) + ".jpg"
						thumbDest := filepath.Join(coverBaseDir, thumbName)
						dbCoverPath := "/cover/" + thumbName

						cmd := exec.Command(ffmpegPath, "-y", "-i", videoFileAbs, "-ss", "00:00:02.000", "-vframes", "1", thumbDest)
						cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
						_ = cmd.Run()
						_, _ = db.Exec("INSERT OR IGNORE INTO videos (title, video_path, cover_path, duration, is_group) VALUES (?, ?, ?, ?, 0)",
							file.Name(), videoFileRel, dbCoverPath, durationStr)

						if firstThumb == "" {
							firstThumb = dbCoverPath
						}
					} else {
						if firstThumb == "" {
							_ = db.QueryRow("SELECT cover_path FROM videos WHERE video_path = ?", videoFileRel).Scan(&firstThumb)
						}
					}
				}
			}
			if !groupExists && firstThumb != "" {
				result, insertErr := db.Exec("INSERT OR IGNORE INTO videos (title, video_path, cover_path, is_group) VALUES (?, ?, ?, 1)",
					folderName, folderPathRel, firstThumb)

				if insertErr == nil {
					rows, _ := result.RowsAffected()
					if rows > 0 {
						fmt.Printf("✓ Folder Episode Baru Terdaftar: %s\n", folderName)
					}
				}
			}
		}
	}
	return nil
}
