param(
  [string]$InputFile = "",
  [string]$OutputDir = "vobe2/www.ziuwedding.site/videos/wedding-logo-hls",
  [int]$SegmentDuration = 4,
  [int]$ThumbnailIntervalSec = 2,
  [switch]$ForceRebuild
)

$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
  param(
    [string]$PathValue,
    [string]$WorkspaceRoot
  )

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $WorkspaceRoot $PathValue))
}

function Add-FFmpegToPathIfNeeded {
  $wingetBase = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin'
  if ((-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) -and (Test-Path $wingetBase)) {
    $env:Path = "$wingetBase;$env:Path"
  }
}

function Test-RequiredCommand {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay '$Name'. Cai FFmpeg roi chay lai."
  }
}

function Resolve-DefaultInput {
  param([string]$WorkspaceRoot)

  $searchRoot = Join-Path $WorkspaceRoot 'vobe2/www.ziuwedding.site/images'
  if (-not (Test-Path $searchRoot)) {
    throw "Khong tim thay thu muc images: $searchRoot"
  }

  $candidates = Get-ChildItem -Path $searchRoot -Recurse -File -Filter *.mp4 |
    Sort-Object @{ Expression = { if ($_.Name -match 'LOGO') { 0 } else { 1 } } }, @{ Expression = { $_.Length }; Descending = $true }

  if (-not $candidates -or $candidates.Count -eq 0) {
    throw "Khong tim thay file MP4 de build HLS trong $searchRoot"
  }

  return $candidates[0].FullName
}

function Get-VideoProfile {
  param([int]$Height)

  if ($Height -ge 2160) {
    return @{ bitrate = '14000k'; maxrate = '17000k'; bufsize = '28000k'; abitrate = '192k'; codec = 'avc1.640033' }
  }
  if ($Height -ge 1440) {
    return @{ bitrate = '9000k'; maxrate = '11500k'; bufsize = '18000k'; abitrate = '160k'; codec = 'avc1.640032' }
  }
  if ($Height -ge 1080) {
    return @{ bitrate = '5000k'; maxrate = '6500k'; bufsize = '10000k'; abitrate = '128k'; codec = 'avc1.640028' }
  }
  return @{ bitrate = '2400k'; maxrate = '3200k'; bufsize = '4800k'; abitrate = '96k'; codec = 'avc1.64001f' }
}

function Convert-KToBps {
  param([string]$Value)
  return [int]([double]($Value.ToLower().Replace('k', '')) * 1000)
}

function Get-ScaledWidth {
  param(
    [int]$SrcWidth,
    [int]$SrcHeight,
    [int]$TargetHeight
  )

  $raw = [int][Math]::Floor(($SrcWidth * $TargetHeight) / $SrcHeight)
  if ($raw % 2 -ne 0) { $raw -= 1 }
  if ($raw -lt 2) { $raw = 2 }
  return $raw
}

function Get-BestEncoder {
  $encoderText = (& ffmpeg -hide_banner -encoders) -join "`n"
  if ($encoderText -match '\bh264_nvenc\b') { return 'h264_nvenc' }
  if ($encoderText -match '\bh264_qsv\b') { return 'h264_qsv' }
  if ($encoderText -match '\bh264_amf\b') { return 'h264_amf' }
  return 'libx264'
}

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Add-FFmpegToPathIfNeeded
Test-RequiredCommand -Name 'ffmpeg'
Test-RequiredCommand -Name 'ffprobe'

if ([string]::IsNullOrWhiteSpace($InputFile)) {
  $InputFile = Resolve-DefaultInput -WorkspaceRoot $workspaceRoot
}

$inputAbs = Resolve-AbsolutePath -PathValue $InputFile -WorkspaceRoot $workspaceRoot
$outputAbs = Resolve-AbsolutePath -PathValue $OutputDir -WorkspaceRoot $workspaceRoot

if (-not (Test-Path $inputAbs)) {
  throw "Khong tim thay video dau vao: $inputAbs"
}

$probeJson = & ffprobe -v error -print_format json -show_streams $inputAbs
$probe = $probeJson | ConvertFrom-Json
$videoStream = $probe.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
$audioStream = $probe.streams | Where-Object { $_.codec_type -eq 'audio' } | Select-Object -First 1
$durationProbe = & ffprobe -v error -print_format json -show_format $inputAbs
$durationObj = $durationProbe | ConvertFrom-Json

if (-not $videoStream) {
  throw "Khong tim thay stream video trong file dau vao."
}

$srcWidth = [int]$videoStream.width
$srcHeight = [int]$videoStream.height
$durationSec = [int][Math]::Ceiling([double]($durationObj.format.duration))

if ($srcHeight -le 0 -or $srcWidth -le 0) {
  throw "Khong doc duoc kich thuoc video dau vao."
}

$targetHeights = New-Object System.Collections.Generic.List[int]
if ($srcHeight -ge 2160) { $targetHeights.Add($srcHeight) }
if ($srcHeight -ge 1440) { $targetHeights.Add(1440) }
if ($srcHeight -ge 1080) { $targetHeights.Add(1080) }
if ($srcHeight -ge 720) { $targetHeights.Add(720) }
if ($targetHeights.Count -eq 0) { $targetHeights.Add($srcHeight) }
$targetHeights = $targetHeights | Sort-Object -Descending -Unique

if (-not $ForceRebuild) {
  $masterExists = Test-Path (Join-Path $outputAbs 'master.m3u8')
  $posterExists = Test-Path (Join-Path $outputAbs 'poster.webp')
  $timelineExists = Test-Path (Join-Path $outputAbs 'timeline.json')
  if ($masterExists -and $posterExists -and $timelineExists) {
    Write-Host "Da ton tai bo HLS/day du assets. Bo qua build (dung -ForceRebuild de build lai)."
    exit 0
  }
}

if (Test-Path $outputAbs) {
  Remove-Item -Recurse -Force $outputAbs
}
New-Item -ItemType Directory -Path $outputAbs | Out-Null

$hasAudio = $null -ne $audioStream
$bestEncoder = Get-BestEncoder

Write-Host "Input: $inputAbs"
Write-Host "Source resolution: ${srcWidth}x${srcHeight}"
Write-Host "Duration: $durationSec sec"
Write-Host "Variants: $($targetHeights -join ', ')"
Write-Host "Video encoder: $bestEncoder"
Write-Host "Output: $outputAbs"

$masterLines = New-Object System.Collections.Generic.List[string]
$masterLines.Add('#EXTM3U')
$masterLines.Add('#EXT-X-VERSION:7')
$masterLines.Add('#EXT-X-INDEPENDENT-SEGMENTS')

for ($i = 0; $i -lt $targetHeights.Count; $i++) {
  $height = [int]$targetHeights[$i]
  $width = Get-ScaledWidth -SrcWidth $srcWidth -SrcHeight $srcHeight -TargetHeight $height
  $videoProfile = Get-VideoProfile -Height $height
  $variantDir = Join-Path $outputAbs "v$i"
  $playlistAbs = Join-Path $variantDir 'prog.m3u8'
  $segmentPattern = Join-Path $variantDir 'seg_%06d.ts'
  $isSourceVariant = ($height -eq $srcHeight)

  New-Item -ItemType Directory -Path $variantDir -Force | Out-Null

  $ffArgs = @('-y', '-i', $inputAbs, '-map', '0:v:0')
  if ($hasAudio) { $ffArgs += @('-map', '0:a:0') }

  if ($isSourceVariant) {
    $ffArgs += @('-c:v', 'copy')
    if ($hasAudio) {
      $ffArgs += @('-c:a', 'copy')
    }
  } else {
    $ffArgs += @('-vf', "scale=w=-2:h=${height}:force_original_aspect_ratio=decrease")

    if ($bestEncoder -eq 'libx264') {
      $ffArgs += @(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-profile:v', 'high',
        '-b:v', $videoProfile.bitrate,
        '-maxrate', $videoProfile.maxrate,
        '-bufsize', $videoProfile.bufsize,
        '-g', '60',
        '-keyint_min', '60',
        '-sc_threshold', '0'
      )
    } elseif ($bestEncoder -eq 'h264_nvenc') {
      $ffArgs += @(
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',
        '-tune', 'hq',
        '-rc', 'vbr',
        '-b:v', $videoProfile.bitrate,
        '-maxrate', $videoProfile.maxrate,
        '-bufsize', $videoProfile.bufsize,
        '-g', '60'
      )
    } elseif ($bestEncoder -eq 'h264_qsv') {
      $ffArgs += @(
        '-c:v', 'h264_qsv',
        '-b:v', $videoProfile.bitrate,
        '-maxrate', $videoProfile.maxrate,
        '-bufsize', $videoProfile.bufsize,
        '-g', '60'
      )
    } else {
      $ffArgs += @(
        '-c:v', 'h264_amf',
        '-b:v', $videoProfile.bitrate,
        '-maxrate', $videoProfile.maxrate,
        '-bufsize', $videoProfile.bufsize,
        '-g', '60'
      )
    }

    if ($hasAudio) {
      $ffArgs += @('-c:a', 'aac', '-b:a', $videoProfile.abitrate, '-ac', '2', '-ar', '48000')
    }
  }

  $ffArgs += @(
    '-f', 'hls',
    '-hls_time', "$SegmentDuration",
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', $segmentPattern,
    $playlistAbs
  )

  Write-Host "Encode variant ${height}p ..."
  & ffmpeg @ffArgs
  if ($LASTEXITCODE -ne 0) {
    throw "FFmpeg encode failed at variant ${height}p."
  }

  $avgBps = Convert-KToBps -Value $videoProfile.bitrate
  $maxBps = Convert-KToBps -Value $videoProfile.maxrate
  $codecStr = if ($hasAudio) { "$($videoProfile.codec),mp4a.40.2" } else { $videoProfile.codec }

  $masterLines.Add("#EXT-X-STREAM-INF:BANDWIDTH=$maxBps,AVERAGE-BANDWIDTH=$avgBps,RESOLUTION=${width}x${height},FRAME-RATE=30.000,CODECS=`"$codecStr`"")
  $masterLines.Add("v$i/prog.m3u8")
}

$masterPath = Join-Path $outputAbs 'master.m3u8'
$masterLines -join "`n" | Set-Content -Path $masterPath -Encoding UTF8

$posterFileAbs = Join-Path $outputAbs 'poster.webp'
$thumbDirAbs = Join-Path $outputAbs 'thumbs'
$thumbPatternAbs = Join-Path $thumbDirAbs 'thumb_%04d.webp'

New-Item -ItemType Directory -Path $thumbDirAbs -Force | Out-Null

& ffmpeg -y -i $inputAbs -ss 2 -frames:v 1 -vf 'scale=w=1280:h=-2:force_original_aspect_ratio=decrease' -c:v libwebp -quality 82 -compression_level 6 $posterFileAbs
if ($LASTEXITCODE -ne 0) {
  throw "Tao poster that bai."
}

& ffmpeg -y -i $inputAbs -vf "fps=1/$ThumbnailIntervalSec,scale=w=320:h=-2:force_original_aspect_ratio=decrease" -c:v libwebp -quality 72 -compression_level 6 $thumbPatternAbs
if ($LASTEXITCODE -ne 0) {
  throw "Tao thumbnail timeline that bai."
}

$thumbFiles = Get-ChildItem -Path $thumbDirAbs -Filter 'thumb_*.webp' | Sort-Object Name
if (-not $thumbFiles -or $thumbFiles.Count -eq 0) {
  throw "Khong tao duoc thumbnail nao."
}

$firstThumb = $thumbFiles[0].FullName
$thumbProbeJson = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json $firstThumb
$thumbProbe = $thumbProbeJson | ConvertFrom-Json

$outputAbsPosix = $outputAbs.Replace('\', '/')
$workspacePosix = $workspaceRoot.Replace('\', '/')
$outputRel = $outputAbsPosix.Substring($workspacePosix.Length + 1)

$timelineObj = [ordered]@{
  interval = $ThumbnailIntervalSec
  count = $thumbFiles.Count
  digits = 4
  pattern = 'thumb_%04d.webp'
  width = [int]$thumbProbe.streams[0].width
  height = [int]$thumbProbe.streams[0].height
  duration = $durationSec
  basePath = "$outputRel/thumbs"
  poster = "$outputRel/poster.webp"
}

$timelineFileAbs = Join-Path $outputAbs 'timeline.json'
$timelineObj | ConvertTo-Json | Set-Content -Path $timelineFileAbs -Encoding UTF8

# Ensure no stale fMP4 artifacts remain from older builds.
Get-ChildItem -Path $outputAbs -Recurse -File -Include '*.m4s','init.mp4' -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Hoan tat HLS."
Write-Host "Master: $masterPath"
Write-Host "Poster: $posterFileAbs"
Write-Host "Timeline: $timelineFileAbs"
