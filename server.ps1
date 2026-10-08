# Lightweight PowerShell HTTP Server for SearchForge SEO Rescue
# Zero dependencies: runs out-of-the-box on Windows via built-in .NET System.Net.HttpListener

$port = 3000
$rootPath = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " SearchForge SEO Rescue Server Running!" -ForegroundColor Yellow
    Write-Host " URL: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host " Local IP: http://127.0.0.1:$port/" -ForegroundColor Cyan
    Write-Host " Audit Hub: http://localhost:$port/audit.html" -ForegroundColor Cyan
    Write-Host " Press Ctrl+C in this terminal to stop the server." -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Green

    # Attempt to open default browser if interactive
    Start-Process "http://localhost:$port/" -ErrorAction SilentlyContinue

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $rawUrl = $request.Url.LocalPath
            if ($rawUrl -eq "/" -or [string]::IsNullOrWhiteSpace($rawUrl)) { 
                $rawUrl = "/index.html" 
            }
            
            $relPath = $rawUrl.TrimStart("/").Replace('/', '\')
            $filePath = Join-Path $rootPath $relPath

            # If folder requested without trailing slash or with slash, check for index.html
            if (Test-Path $filePath -PathType Container) {
                $filePath = Join-Path $filePath "index.html"
            }

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                
                $mime = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".svg"  { "image/svg+xml" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    ".webp" { "image/webp" }
                    ".xml"  { "application/xml; charset=utf-8" }
                    ".txt"  { "text/plain; charset=utf-8" }
                    ".pdf"  { "application/pdf" }
                    ".ico"  { "image/x-icon" }
                    default { "application/octet-stream" }
                }
                
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode = 200
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $notFoundPath = Join-Path $rootPath "404.html"
                if (Test-Path $notFoundPath -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($notFoundPath)
                    $response.ContentType = "text/html; charset=utf-8"
                    $response.ContentLength64 = $bytes.Length
                    $response.StatusCode = 404
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    }
                } else {
                    $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $response.ContentType = "text/plain; charset=utf-8"
                    $response.StatusCode = 404
                    $response.ContentLength64 = $notFoundMsg.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
                    }
                }
            }
        }
        catch {
            # Catch transient socket or stream errors per request without terminating the server
            Write-Host "Notice: Client connection closed or HEAD request handled." -ForegroundColor DarkGray
        }
        finally {
            try { $response.Close() } catch {}
        }
    }
}
catch {
    Write-Error $_
}
finally {
    $listener.Stop()
}
