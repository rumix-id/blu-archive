@echo off
set APP_NAME=blu-archive.exe
set UPX_BIN=upx\upx.exe

echo ---------------------------------------------------
echo Starting UPX Compression for %APP_NAME%
echo ---------------------------------------------------

if exist %APP_NAME% (
    %UPX_BIN% --best --ultra-brute %APP_NAME%
    echo.
    echo Done! The file size is now much smaller.
) else (
    echo Error: File %APP_NAME% not found!
    echo Make sure this script is placed in the same folder as the application.
)

pause