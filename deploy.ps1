<#
.SYNOPSIS
    Deploy và quản lý Wedding Web (thiepminh) lên Home Server từ Windows PowerShell.
    Đọc và tương thích hoàn toàn với quy trình của ./deploy.sh trên server.

.DESCRIPTION
    Script thực hiện:
    1. Đóng gói mã nguồn 2 thư mục: FE_Wedding_Web và BE_Wedding_Web
       (kèm deploy.sh và ecosystem.config.cjs ở thư mục gốc).
       Tự động loại bỏ các thư mục nặng/không cần thiết:
       node_modules, dist, .git, .env, runtime uploads (images/music), logs,...
    2. Upload gói nén duy nhất lên Home Server qua SCP (tốc độ nhanh, không nghẽn mạng).
    3. Kết nối SSH giải nén vào thư mục server và thực thi lệnh tương ứng của ./deploy.sh:
       - update: cập nhật code, cài phụ thuộc, migrate DB, build FE, restart PM2 (Mặc định)
       - up: triển khai lần đầu (sinh .env, migrate, build, bật PM2)
       - push-only: chỉ tải mã nguồn lên và giải nén, không chạy deploy.sh
       - restart: khởi động lại PM2
       - stop: dừng PM2
       - logs: xem logs thời gian thực
       - ps: xem trạng thái PM2
       - doctor: kiểm tra môi trường, cổng, CSDL
       - seed: tạo tài khoản admin ban đầu
       - backup: sao lưu CSDL và uploads
       - ssh: mở terminal SSH vào thư mục dự án trên server

.EXAMPLE
    .\deploy.ps1                      # Mặc định: Nén code, tải lên và chạy deploy.sh update
    .\deploy.ps1 up                   # Chạy lần đầu trên máy chủ mới
    .\deploy.ps1 update -SkipTemplates # Cập nhật siêu tốc (bỏ qua templates, file nén chỉ ~250KB)
    .\deploy.ps1 logs                 # Xem log hệ thống trên server
    .\deploy.ps1 doctor               # Kiểm tra sức khỏe máy chủ
    .\deploy.ps1 ssh                  # Truy cập SSH trực tiếp vào thư mục dự án
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [ValidateSet("update", "up", "push-only", "restart", "stop", "logs", "ps", "doctor", "seed", "backup", "ssh", "help")]
    [string]$Action = "update",

    [Parameter(Position = 1)]
    [string]$Target = "",

    [Parameter()]
    [string]$HostName = "",

    [Parameter()]
    [string]$User = "",

    [Parameter()]
    [int]$Port = 0,

    [Parameter()]
    [string]$RemotePath = "",

    [Parameter()]
    [string]$KeyFile = "",

    [Parameter()]
    [switch]$SkipTemplates,

    [Parameter()]
    [switch]$IncludeEnv,

    [Parameter()]
    [switch]$DryRun
)

# Thiết lập bảng mã UTF-8 cho console PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Định nghĩa hàm hiển thị thông báo
function Write-Step    ([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Success ([string]$msg) { Write-Host " ok  $msg" -ForegroundColor Green }
function Write-Warn    ([string]$msg) { Write-Host " !!  $msg" -ForegroundColor Yellow }
function Write-Err     ([string]$msg) { Write-Host " xx  $msg" -ForegroundColor Red }

# Thư mục gốc chứa mã nguồn ở máy local
$SCRIPT_ROOT = $PSScriptRoot
$BE_DIR = Join-Path $SCRIPT_ROOT "BE_Wedding_Web"
$FE_DIR = Join-Path $SCRIPT_ROOT "FE_Wedding_Web"
$DEPLOY_SH = Join-Path $SCRIPT_ROOT "deploy.sh"
$PM2_CONFIG = Join-Path $SCRIPT_ROOT "ecosystem.config.cjs"
$CONFIG_FILE = Join-Path $SCRIPT_ROOT "deploy.config.json"

if ($Action -eq "help") {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# ---------------------------------------------------------------------------
# 1. Đọc và hợp nhất cấu hình kết nối (deploy.config.json)
# ---------------------------------------------------------------------------
$Config = @{
    Host       = ""
    User       = ""
    Port       = 22
    RemotePath = "~/thiepcodau"
    KeyFile    = ""
}

if (Test-Path $CONFIG_FILE) {
    try {
        $loadedConfig = Get-Content $CONFIG_FILE -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($loadedConfig.Host)       { $Config.Host = [string]$loadedConfig.Host }
        if ($loadedConfig.User)       { $Config.User = [string]$loadedConfig.User }
        if ($loadedConfig.Port)       { $Config.Port = [int]$loadedConfig.Port }
        if ($loadedConfig.RemotePath) { $Config.RemotePath = [string]$loadedConfig.RemotePath }
        if ($loadedConfig.KeyFile)    { $Config.KeyFile = [string]$loadedConfig.KeyFile }
    } catch {
        Write-Warn "Khong the doc $CONFIG_FILE, su dung cau hinh mac dinh."
    }
}

# Tham số truyền qua dòng lệnh có mức ưu tiên cao nhất
if ($HostName)   { $Config.Host = $HostName }
if ($User)       { $Config.User = $User }
if ($Port -gt 0) { $Config.Port = $Port }
if ($RemotePath) { $Config.RemotePath = $RemotePath }
if ($KeyFile)    { $Config.KeyFile = $KeyFile }

# Nếu chưa có Host hoặc User, hỗ trợ nhập cấu hình tương tác lần đầu
if (-not $Config.Host -or -not $Config.User) {
    Write-Step "Thiet lap thong tin Home Server (chi can nhap lan dau):"
    
    if (-not $Config.Host) {
        $Config.Host = (Read-Host " Dia chi IP / Hostname server (vi du: 192.168.1.100)").Trim()
    }
    if (-not $Config.User) {
        $Config.User = (Read-Host " Ten tai khoan SSH (vi du: ubuntu, thanh)").Trim()
    }
    $inputPort = Read-Host " Cong SSH (mac dinh: 22, nhan Enter de giu nguyen)"
    if ($inputPort.Trim() -ne "") {
        $Config.Port = [int]$inputPort.Trim()
    }
    $inputPath = Read-Host " Thu muc trien khai tren server (mac dinh: '~/thiepcodau')"
    if ($inputPath.Trim() -ne "") {
        $Config.RemotePath = $inputPath.Trim()
    }
    $inputKey = Read-Host " Duong dan SSH private key (de trong neu dung mat khau hoac ssh-agent)"
    if ($inputKey.Trim() -ne "") {
        $Config.KeyFile = $inputKey.Trim()
    }

    if ($Config.Host -and $Config.User) {
        $saveChoice = Read-Host " Luu cau hinh vao deploy.config.json? (Y/n)"
        if ($saveChoice.Trim().ToLower() -ne "n") {
            $Config | ConvertTo-Json -Depth 2 | Set-Content $CONFIG_FILE -Encoding UTF8
            Write-Success "Da luu cau hinh vao deploy.config.json"
        }
    } else {
        Write-Err "Thieu Host hoac User. Khong the ket noi toi server."
        exit 1
    }
}

# Kiểm tra công cụ cần thiết trên máy Windows
$tarCmd = Get-Command "tar.exe" -ErrorAction SilentlyContinue
$sshCmd = Get-Command "ssh.exe" -ErrorAction SilentlyContinue
$scpCmd = Get-Command "scp.exe" -ErrorAction SilentlyContinue

if (-not $sshCmd -or -not $scpCmd) {
    Write-Err "Khong tim thay OpenSSH (ssh.exe, scp.exe). Vui long kiem tra Windows OpenSSH Client."
    exit 1
}
if (-not $tarCmd) {
    Write-Err "Khong tim thay tar.exe trong C:\Windows\System32\tar.exe."
    exit 1
}

# Xây dựng tham số SSH / SCP chung
$sshArgs = @()
$scpArgs = @()

if ($Config.Port -and $Config.Port -ne 22) {
    $sshArgs += @("-p", [string]$Config.Port)
    $scpArgs += @("-P", [string]$Config.Port)
}
if ($Config.KeyFile -and (Test-Path $Config.KeyFile)) {
    $sshArgs += @("-i", $Config.KeyFile)
    $scpArgs += @("-i", $Config.KeyFile)
}

$remoteUserHost = "$($Config.User)@$($Config.Host)"

# Hàm chạy lệnh bash trên server (sử dụng login shell để tự động load nvm/node/pm2)
function Invoke-RemoteBash([string]$bashCommands) {
    $wrappedCommand = "bash -l -c `"$bashCommands`""
    if ($DryRun) {
        Write-Warn "[DryRun] SSH: ssh $($sshArgs -join ' ') $remoteUserHost `"$wrappedCommand`""
        return 0
    }
    & $sshCmd.Path @sshArgs $remoteUserHost $wrappedCommand
    return $LASTEXITCODE
}

# Đoạn mã bash chuẩn hóa thư mục đích trên server
$targetDirBash = "TARGET_DIR=`$(eval echo `"$($Config.RemotePath)`") && mkdir -p `"`$TARGET_DIR`" && cd `"`$TARGET_DIR`""

# ---------------------------------------------------------------------------
# 2. Xử lý các Action chỉ chạy qua SSH (không cần upload code)
# ---------------------------------------------------------------------------
switch ($Action) {
    "ssh" {
        Write-Step "Mo phien SSH truc tiep toi $remoteUserHost (thu muc: $($Config.RemotePath))..."
        $interactiveCmd = "bash -l -c `"$targetDirBash && exec bash -l`""
        & $sshCmd.Path -t @sshArgs $remoteUserHost $interactiveCmd
        exit $LASTEXITCODE
    }
    "logs" {
        Write-Step "Xem log tren server qua ./deploy.sh logs $Target..."
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh logs $Target"
        exit $LASTEXITCODE
    }
    "ps" {
        Write-Step "Trang thai tien trinh PM2 tren server:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh ps"
        exit $LASTEXITCODE
    }
    "doctor" {
        Write-Step "Kiem tra tinh trang server qua ./deploy.sh doctor:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh doctor"
        exit $LASTEXITCODE
    }
    "restart" {
        Write-Step "Khoi dong lai ung dung qua ./deploy.sh restart:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh restart"
        exit $LASTEXITCODE
    }
    "stop" {
        Write-Step "Tam dung ung dung qua ./deploy.sh stop:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh stop"
        exit $LASTEXITCODE
    }
    "seed" {
        Write-Step "Khoi tao tai khoan quan tri tren server qua ./deploy.sh seed:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh seed"
        exit $LASTEXITCODE
    }
    "backup" {
        Write-Step "Sao luu CSDL va du lieu uploads tren server qua ./deploy.sh backup:"
        Invoke-RemoteBash "$targetDirBash && ./deploy.sh backup"
        exit $LASTEXITCODE
    }
}

# ---------------------------------------------------------------------------
# 3. Các Action tải mã nguồn lên server: update, up, push-only
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Bat dau quy trinh deploy ($Action) len Home Server: $remoteUserHost"
Write-Host "      Thu muc dich : $($Config.RemotePath)"
Write-Host "      Cong SSH     : $($Config.Port)"
Write-Host ""

# Kiểm tra thư mục nguồn
if (-not (Test-Path $BE_DIR) -or -not (Test-Path $FE_DIR)) {
    Write-Err "Khong tim thay thu muc BE_Wedding_Web hoac FE_Wedding_Web tai $SCRIPT_ROOT"
    exit 1
}
if (-not (Test-Path $DEPLOY_SH)) {
    Write-Err "Khong tim thay deploy.sh tai $SCRIPT_ROOT"
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "deploy_payload_$timestamp.tar.gz"
$archiveLocalPath = Join-Path $SCRIPT_ROOT $archiveName

try {
    # 3.1. Đóng gói mã nguồn bằng tar.exe
    Write-Step "Dong goi ma nguon FE va BE (loai bo node_modules, dist, uploads, git, env)..."

    $excludeList = @(
        "--exclude", "node_modules",
        "--exclude", "dist",
        "--exclude", ".git",
        "--exclude", "logs",
        "--exclude", "uploads/images",
        "--exclude", "uploads/music",
        "--exclude", "uploads/invitations",
        "--exclude", "uploads/tmp",
        "--exclude", "uploads/test",
        "--exclude", "*.log",
        "--exclude", ".DS_Store",
        "--exclude", "Thumbs.db",
        "--exclude", ".vscode",
        "--exclude", ".idea"
    )

    if (-not $IncludeEnv) {
        $excludeList += @("--exclude", ".env", "--exclude", ".env.local")
    }

    if ($SkipTemplates) {
        Write-Warn "Che do -SkipTemplates bat: Bo qua thu muc uploads/templates de nen sieu toc."
        $excludeList += @("--exclude", "uploads/templates")
    }

    $tarItems = @("BE_Wedding_Web", "FE_Wedding_Web", "deploy.sh")
    if (Test-Path $PM2_CONFIG) {
        $tarItems += "ecosystem.config.cjs"
    }

    # Thực hiện lệnh tar tại thư mục gốc của repo
    Push-Location $SCRIPT_ROOT
    try {
        if ($DryRun) {
            Write-Warn "[DryRun] Se tao file nen: $archiveLocalPath"
        } else {
            & $tarCmd.Path -czf $archiveName @excludeList @tarItems
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path $archiveLocalPath)) {
                Write-Err "Loi khi nen ma nguon bang tar.exe"
                exit 1
            }
            $archiveSizeMB = [math]::Round(((Get-Item $archiveLocalPath).Length / 1MB), 2)
            Write-Success "Da tao goi trien khai: $archiveName ($archiveSizeMB MB)"
        }
    } finally {
        Pop-Location
    }

    if ($DryRun) {
        Write-Success "[DryRun] Kiem tra hoan tat. Khong upload hay chay lenh tren may chu."
        exit 0
    }

    # 3.2. Chuẩn bị thư mục đích trên server
    Write-Step "Kiem tra thu muc dich tren server..."
    Invoke-RemoteBash $targetDirBash | Out-Null

    # 3.3. Tải file nén lên server qua SCP
    Write-Step "Tai goi nen len may chu qua SCP..."
    $remoteUploadDest = "$remoteUserHost`:$($Config.RemotePath)/$archiveName"
    & $scpCmd.Path @scpArgs $archiveLocalPath $remoteUploadDest
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Tai file qua SCP that bai. Vui long kiem tra quyen ghi hoac ket noi SSH."
        exit 1
    }
    Write-Success "Tai len server thanh cong."

    # 3.4. Giải nén và kích hoạt deploy.sh trên server
    Write-Step "Giai nen ma nguon tren server va cap nhat quyen thuc thi..."
    $extractAndCleanCmd = "$targetDirBash && tar -xzf $archiveName && rm -f $archiveName && chmod +x deploy.sh"
    
    if ($Action -eq "push-only") {
        Invoke-RemoteBash $extractAndCleanCmd
        Write-Success "Da cap nhat ma nguon len server (push-only). Chua chay deploy.sh."
        exit 0
    }

    if ($Action -eq "up") {
        Write-Step "Kich hoat cai dat lan dau tren server (./deploy.sh up)..."
        $runDeployCmd = "$extractAndCleanCmd && ./deploy.sh up"
        Invoke-RemoteBash $runDeployCmd
    } elseif ($Action -eq "update") {
        Write-Step "Kich hoat cap nhat ung dung tren server (KHONG_PULL=1 ./deploy.sh update)..."
        $runDeployCmd = "$extractAndCleanCmd && export KHONG_PULL=1 && ./deploy.sh update"
        Invoke-RemoteBash $runDeployCmd
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Success "Trien khai hoan tat thanh cong!"
    } else {
        Write-Host ""
        Write-Warn "Qua trinh ket thuc voi ma tra ve $LASTEXITCODE. Xem log: .\deploy.ps1 logs"
    }

} finally {
    # 3.5. Dọn dẹp file nén tạm thời tại máy local
    if (Test-Path $archiveLocalPath) {
        Remove-Item $archiveLocalPath -Force -ErrorAction SilentlyContinue
    }
}

