@echo off
title Push SearchForge SEO to GitHub
echo ========================================================
echo   SearchForge SEO - Push to GitHub (Arya Tiwari)
echo ========================================================
echo.
echo Target Repo: https://github.com/httpsarya/Searchforge-SEO.git
echo Branch:      main
echo.

set "GIT_EXE=C:\Users\hp\.gemini\antigravity\scratch\tools\mingit\cmd\git.exe"

if not exist "%GIT_EXE%" (
    echo [ERROR] Git executable not found at %GIT_EXE%
    pause
    exit /b 1
)

echo Pushing code to GitHub...
echo (If prompted, log in with your GitHub account or Personal Access Token)
echo.

"%GIT_EXE%" push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCESS: Repository published to GitHub!
    echo  View it here: https://github.com/httpsarya/Searchforge-SEO
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  PUSH FAILED: Please check your GitHub credentials.
    echo ========================================================
)

echo.
pause
