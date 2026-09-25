<#
.SYNOPSIS
    Deploy va quan ly Wedding Web (thiepminh) len Home Server qua Git.
    Tu dong dong bo ma nguon he thong chinh len GitHub, may chu keo ve va chay ./deploy.sh.

.DESCRIPTION
    Quy trinh:
    1. May local: Kiem tra commit va push ma nguon he thong chinh len GitHub (branch main).
       Cac thu muc phu khong lien quan (theme demo, LUAT_AGENT, .claude, config ca nhan)
       da duoc .gitignore loai bo hoan toan khoi Git.
    2. May chu (Home Server):
       - Neu chua co ma nguon tren server: Tu dong clone tu GitHub vao thu muc dich.
       - Neu da co ma nguon: git fetch & git reset --hard origin/main de cap nhat sach se.
       - Chay ./deploy.sh tren server: tu dong cai dependencies, chay migration CSDL, build giao dien va bat PM2.

.EXAMPLE
    .\deploy.ps1                      # Mac dinh: Push Git local -> Server keo ma -> chay deploy.sh update
    .\deploy.ps1 up                   # Chay lan dau tren server moi (clone repo, tao .env, migrate, build, bat PM2)
    .\deploy.ps1 update -SkipPush     # Chi bao server keo ma moi tu Git (bo qua push o local)
    .\deploy.ps1 pull-only            # Chi keo ma tren server, khong build hay restart PM2
    .\deploy.ps1 restart              # Khoi dong lai PM2 tren server qua SSH
    .\deploy.ps1 logs                 # Xem log thoi gian thuc tren server
    .\deploy.ps1 logs thiepminh-api   # Xem rieng log backend Express
    .\deploy.ps1 ps                   # Xem danh sach tien trinh PM2
    .\deploy.ps1 doctor               # Kiem tra ket noi CSDL, Node, cong mang tren server
    .\deploy.ps1 seed                 # Khoi tao tai khoan quan tri admin tren server
    .\deploy.ps1 backup               # Sao luu CSDL va du lieu uploads tren server
    .\deploy.ps1 ssh                  # Mo terminal SSH truc tiep vao thu muc du an tren server
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [ValidateSet("update", "up", "pull-only", "restart", "stop", "logs", "ps", "doctor", "seed", "backup", "ssh", "help")]
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
    [string]$RepoUrl = "https://github.com/Van-is-code/thiepcodau.git",

    [Parameter()]
    [string]$Branch = "main",

    [Parameter()]
    [switch]$SkipPush,

    [Parameter()]
    [switch]$DryRun
)

# Thiet lap bang ma UTF-8 cho console PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Dinh nghia ham hien thi thong bao
function Write-Step    ([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Success ([string]$msg) { Write-Host " ok  $msg" -ForegroundColor Green }
function Write-Warn    ([string]$msg) { Write-Host " !!  $msg" -ForegroundColor Yellow }
function Write-Err     ([string]$msg) { Write-Host " xx  $msg" -ForegroundColor Red }

$SCRIPT_ROOT = $PSScriptRoot
$CONFIG_FILE = Join-Path $SCRIPT_ROOT "deploy.config.json"

if ($Action -eq "help") {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# ---------------------------------------------------------------------------
# 1. Doc va hop nhat cau hinh ket noi (deploy.config.json)
# ---------------------------------------------------------------------------
$Config = @{
    Host       = ""
    User       = ""
    Port       = 22
    RemotePath = "weddingWeb"
    KeyFile    = ""
    RepoUrl    = $RepoUrl
    Branch     = $Branch
}

if (Test-Path $CONFIG_FILE) {
    try {
        $loadedConfig = Get-Content $CONFIG_FILE -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($loadedConfig.Host)       { $Config.Host = [string]$loadedConfig.Host }
        if ($loadedConfig.User)       { $Config.User = [string]$loadedConfig.User }
        if ($loadedConfig.Port)       { $Config.Port = [int]$loadedConfig.Port }
        if ($loadedConfig.RemotePath) { $Config.RemotePath = [string]$loadedConfig.RemotePath }
        if ($loadedConfig.KeyFile)    { $Config.KeyFile = [string]$loadedConfig.KeyFile }
        if ($loadedConfig.RepoUrl)    { $Config.RepoUrl = [string]$loadedConfig.RepoUrl }
        if ($loadedConfig.Branch)     { $Config.Branch = [string]$loadedConfig.Branch }
    } catch {
        Write-Warn "Khong the doc $CONFIG_FILE, su dung cau hinh mac dinh."
    }
}

# Tham so truyen qua dong lenh co muc uu tien cao nhat
if ($HostName)   { $Config.Host = $HostName }
if ($User)       { $Config.User = $User }
if ($Port -gt 0) { $Config.Port = $Port }
if ($RemotePath) { $Config.RemotePath = $RemotePath }
if ($KeyFile)    { $Config.KeyFile = $KeyFile }

# Kiem tra thong tin ket noi
if (-not $Config.Host -or -not $Config.User) {
    Write-Err "Thieu thong tin Host hoac User trong deploy.config.json"
    exit 1
}

# Kiem tra cong cu can thiet
$sshCmd = Get-Command "ssh.exe" -ErrorAction SilentlyContinue
$gitCmd = Get-Command "git.exe" -ErrorAction SilentlyContinue

if (-not $sshCmd) {
    Write-Err "Khong tim thay ssh.exe. Vui long kiem tra Windows OpenSSH Client."
    exit 1
}
if (-not $gitCmd) {
    Write-Err "Khong tim thay git.exe."
    exit 1
}

# Xay dung tham so SSH
$sshArgs = @()
if ($Config.Port -and $Config.Port -ne 22) {
    $sshArgs += @("-p", [string]$Config.Port)
}
if ($Config.KeyFile -and (Test-Path $Config.KeyFile)) {
    $sshArgs += @("-i", $Config.KeyFile)
}

$remoteUserHost = "$($Config.User)@$($Config.Host)"

# Ham gui va thuc thi bash script tren server qua Base64 (tuyet doi an toan, tranh moi loi ky tu/newline)
function Invoke-RemoteScript([string]$scriptText) {
    if ($DryRun) {
        Write-Warn "[DryRun] Script se chay tren ${remoteUserHost}:"
        Write-Host $scriptText -ForegroundColor DarkGray
        return 0
    }
    $unixScript = $scriptText.Replace("`r`n", "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($unixScript)
    $b64 = [Convert]::ToBase64String($bytes)
    & $sshCmd.Path @sshArgs $remoteUserHost "echo $b64 | base64 -d | bash -l"
    return $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# 2. Xu ly Action "ssh" (mo terminal tuong tac truc tiep)
# ---------------------------------------------------------------------------
if ($Action -eq "ssh") {
    Write-Step "Mo terminal SSH truc tiep toi $remoteUserHost (thu muc: $($Config.RemotePath))..."
    $remoteDirInit = "if [[ `"$($Config.RemotePath)`" = /* ]]; then TARGET_DIR=`"$($Config.RemotePath)`"; elif [[ `"$($Config.RemotePath)`" = ~* ]]; then TARGET_DIR=`$(eval echo `"$($Config.RemotePath)`"); else TARGET_DIR=`"`$HOME/$($Config.RemotePath)`"; fi; cd `"`$TARGET_DIR`" 2>/dev/null; exec bash -l"
    & $sshCmd.Path -t @sshArgs $remoteUserHost $remoteDirInit
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# 3. Kiem tra va Day ma nguon tu Local len GitHub (neu action can deploy)
# ---------------------------------------------------------------------------
$needsGitSync = ($Action -in @("update", "up", "pull-only"))

if ($needsGitSync -and -not $SkipPush) {
    Push-Location $SCRIPT_ROOT
    try {
        Write-Step "Kiem tra trang thai Git tai may local..."
        $statusOutput = & $gitCmd.Path status -s
        if ($statusOutput) {
            Write-Step "Phat hien thay doi o local. Tien hanh commit..."
            & $gitCmd.Path add .
            & $gitCmd.Path commit -m "Auto commit truoc khi deploy ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
        }

        $statusDetailed = & $gitCmd.Path status
        if ($statusDetailed -match "ahead of") {
            Write-Step "Day ma moi len GitHub (git push origin $($Config.Branch))..."
            if (-not $DryRun) {
                & $gitCmd.Path push origin $Config.Branch
                if ($LASTEXITCODE -ne 0) {
                    Write-Err "Day ma len GitHub that bai. Vui long kiem tra ket noi mang hoac quyen Git."
                    exit 1
                }
                Write-Success "Da day ma len GitHub thanh cong."
            } else {
                Write-Warn "[DryRun] Se thuc hien: git push origin $($Config.Branch)"
            }
        } else {
            Write-Success "Ma nguon local da dong bo voi GitHub."
        }
    } finally {
        Pop-Location
    }
}

if ($DryRun) {
    Write-Success "[DryRun] Kiem tra hoan tat. Khong thuc thi tren server."
    exit 0
}

# ---------------------------------------------------------------------------
# 4. Thuc thi lenh tren Home Server qua SSH
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Thuc thi [$Action] tren Home Server: $remoteUserHost"
Write-Host "      Thu muc server : $($Config.RemotePath)"

# Xay dung bash script hoan chinh
$remoteScript = @"
REMOTE_PATH='$($Config.RemotePath)'
REPO_URL='$($Config.RepoUrl)'
BRANCH='$($Config.Branch)'
ACTION='$Action'
TARGET_PARAM='$Target'

# Chuan hoa duong dan thu muc tren server
if [[ "`$REMOTE_PATH" = /* ]]; then
    TARGET_DIR="`$REMOTE_PATH"
elif [[ "`$REMOTE_PATH" = ~* ]]; then
    TARGET_DIR=`$(eval echo "`$REMOTE_PATH")
else
    TARGET_DIR="`$HOME/`$REMOTE_PATH"
fi

# Xu ly Git cho cac action can ma nguon (update, up, pull-only)
if [[ "`$ACTION" == "update" || "`$ACTION" == "up" || "`$ACTION" == "pull-only" ]]; then
    if [ ! -d "`$TARGET_DIR/.git" ]; then
        echo "==> Thu muc chua co Git. Dang clone tu GitHub..."
        mkdir -p "`$(dirname "`$TARGET_DIR")"
        git clone -b "`$BRANCH" "`$REPO_URL" "`$TARGET_DIR"
    else
        echo "==> Cap nhat ma nguon tu GitHub (git fetch & reset)..."
        cd "`$TARGET_DIR"
        git fetch origin "`$BRANCH"
        git reset --hard "origin/`$BRANCH"
        git clean -fd
    fi
fi

if [ ! -d "`$TARGET_DIR" ]; then
    echo "xx Thu muc `$TARGET_DIR khong ton tai tren server." >&2
    exit 1
fi

cd "`$TARGET_DIR"
[ -f "./deploy.sh" ] && chmod +x ./deploy.sh

case "`$ACTION" in
    update)
        ./deploy.sh update
        ;;
    up)
        ./deploy.sh up
        ;;
    pull-only)
        echo " ok  Da cap nhat ma nguon tu Git tren server thanh cong."
        ;;
    restart)
        ./deploy.sh restart
        ;;
    stop)
        ./deploy.sh stop
        ;;
    logs)
        ./deploy.sh logs "`$TARGET_PARAM"
        ;;
    ps)
        ./deploy.sh ps
        ;;
    doctor)
        ./deploy.sh doctor
        ;;
    seed)
        ./deploy.sh seed
        ;;
    backup)
        ./deploy.sh backup
        ;;
    *)
        echo "xx Action khong hop le: `$ACTION" >&2
        exit 1
        ;;
esac
"@

Invoke-RemoteScript $remoteScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Success "Thuc thi [$Action] hoan tat thanh cong!"
} else {
    Write-Host ""
    Write-Warn "Qua trinh ket thuc voi ma loi $LASTEXITCODE. Xem log tren server: .\deploy.ps1 logs"
}
