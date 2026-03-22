package main

import (
	"context"
	"embed"
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

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var _ embed.FS

//go:embed bin/ffprobe.exe
var embeddedFFprobe []byte

//go:embed bin/ffmpeg.exe
var embeddedFFmpeg []byte

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
}

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) SelectFolder() (string, error) {
	selection, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Pilih Gambar Screenshot",
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

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)
	os.Chdir(exPath)

	os.MkdirAll("movie", 0755)
	os.MkdirAll("cover", 0755)
	os.MkdirAll("screenshots", 0755)
	os.MkdirAll("bin", 0755)

	if runtime.GOOS == "windows" {
		ffprobePath := filepath.Join("bin", "ffprobe.exe")
		if _, err := os.Stat(ffprobePath); os.IsNotExist(err) {
			_ = os.WriteFile(ffprobePath, embeddedFFprobe, 0755)
		}
		ffmpegPath := filepath.Join("bin", "ffmpeg.exe")
		if _, err := os.Stat(ffmpegPath); os.IsNotExist(err) {
			if len(embeddedFFmpeg) > 0 {
				_ = os.WriteFile(ffmpegPath, embeddedFFmpeg, 0755)
			}
		}
	}

	initDB()
}
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
		Title:   "Pilih Video",
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

func (a *App) RenameVideo(id int, oldVideoPath string, newTitle string) error {
	var artist, desc, year, oldCoverPath, oldScreenshotPath string
	err := db.QueryRow("SELECT artist, description, release_year, cover_path, screenshot_path FROM videos WHERE id = ?", id).
		Scan(&artist, &desc, &year, &oldCoverPath, &oldScreenshotPath)
	if err != nil {
		return err
	}

	newTitleClean := strings.ReplaceAll(newTitle, " ", "_")
	reg, _ := regexp.Compile(`[\\/:*?"<>|]`)
	newTitleClean = reg.ReplaceAllString(newTitleClean, "")

	finalVideo := oldVideoPath
	finalCover := oldCoverPath
	finalScreenshot := oldScreenshotPath

	if oldVideoPath != "" {
		cleanOldVideo := filepath.Join(".", strings.TrimPrefix(oldVideoPath, "/"))
		extVideo := filepath.Ext(cleanOldVideo)
		newVideoFullPath := filepath.Join("movie", newTitleClean+extVideo)
		if cleanOldVideo != newVideoFullPath {
			if err := os.Rename(cleanOldVideo, newVideoFullPath); err == nil {
				finalVideo = "/" + filepath.ToSlash(newVideoFullPath)
			} else {
				println("Gagal rename video fisik:", err.Error())
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
	if oldScreenshotPath != "" {
		cleanOldImg := filepath.Join(".", strings.TrimPrefix(oldScreenshotPath, "/"))
		extImg := filepath.Ext(cleanOldImg)
		newImgFullPath := filepath.Join("screenshots", newTitleClean+"_screenshot"+extImg)

		if cleanOldImg != newImgFullPath {
			if err := os.Rename(cleanOldImg, newImgFullPath); err == nil {
				finalScreenshot = "/" + filepath.ToSlash(newImgFullPath)
			}
		}
	}
	query := `UPDATE videos SET title=?, artist=?, release_year=?, description=?, screenshot_path=?, cover_path=?, video_path=? WHERE id=?`
	_, err = db.Exec(query, newTitle, artist, year, desc, finalScreenshot, finalCover, finalVideo, id)

	return err
}
func (a *App) UpdateArtist(id int, artist string) error {
	var title, desc, year string
	_ = db.QueryRow("SELECT title, description, release_year FROM videos WHERE id = ?", id).Scan(&title, &desc, &year)
	return a.UpdateVideoData(id, title, artist, desc, year)
}

func (a *App) DeleteVideo(videoID int, videoPath string, coverPath string) error {
	actualVideoPath := filepath.Join(".", strings.TrimPrefix(videoPath, "/"))
	if _, err := os.Stat(actualVideoPath); err == nil {
		err = os.Remove(actualVideoPath)
		if err != nil {
			println("Gagal menghapus file video:", err.Error())
		}
	}
	if !strings.Contains(coverPath, "default-cover.jpg") {
		actualCoverPath := filepath.Join(".", strings.TrimPrefix(coverPath, "/"))
		if _, err := os.Stat(actualCoverPath); err == nil {
			os.Remove(actualCoverPath)
		}
	}
	_, err := db.Exec("DELETE FROM videos WHERE id = ?", videoID)
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
	absPath := filepath.Join(exPath, filepath.FromSlash(cleanVirtualPath))

	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", "start", "", absPath)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	} else if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", absPath)
	} else {
		cmd = exec.Command("xdg-open", absPath)
	}

	err := cmd.Run()
	if err != nil {
		fmt.Printf("Gagal membuka video: %v\n", err)
	}
}

func (a *App) UpdateVideoLocation(videoID int) (string, error) {
	newPath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Pilih Video Baru",
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

	dbPath := filepath.ToSlash(destPath)

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
