package main

import (
	"embed"
	"net/http"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Dapatkan lokasi absolut folder .exe
	ex, _ := os.Executable()
	exPath := filepath.Dir(ex)

	app := NewApp()
	err := wails.Run(&options.App{
		Title:         "",
		Width:         1024,
		Height:        768,
		DisableResize: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// Handler ini kunci agar video bisa diputar
			Handler: http.FileServer(http.Dir(exPath)),
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
