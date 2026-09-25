<#
.SYNOPSIS
    Deploy va quan ly Wedding Web (thiepminh) len Home Server qua Git.
    Tu dong dong bo ma nguon len GitHub, may chu keo ve va chay ./deploy.sh.

.DESCRIPTION
    Quy trinh:
    1. May local: Kiem tra commit va push ma nguon he thong chinh len GitHub (branch main).
       Cac thu muc khong lien quan (theme demo, LUAT_AGENT, .claude, config ca nhan)
       da duoc .gitignore loai bo hoan toan.
    2. May chu (Home Server):
       - Neu chua co ma nguon: git clone tu GitHub vao thu muc tren server.
       - Neu da co ma nguon: git fetch & git reset --hard origin/main de cap nhat sach se.
       - Goi ./deploy.sh de cai dat phu thuoc, chay migration, build FE va bat PM2.

.EXAMPLE
    .\deploy.ps1                      # Mac dinh: Push Git local -> Server keo ma -> chay deploy.sh update
    .\deploy.ps1 up                   # Chay lan dau tren server moi (clone repo, tao .env, build, bat PM2)
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

# Doan ma bash chuan hoa thu muc dich tren server
$targetDirBash = "if [[ `"$($Config.RemotePath)`" = /* ]]; then TARGET_DIR=`"$($Config.RemotePath)`"; elif [[ `"$($Config.RemotePath)`" = ~* ]]; then TARGET_DIR=`$(eval echo `"$($Config.RemotePath)`"); else TARGET_DIR=`"`$HOME/$($Config.RemotePath)`"; fi"

# Ham chay lenh bash tren server qua SSH login shell de nhan du bien moi truong
function Invoke-RemoteBash([string]$bashCommands) {
    $wrappedCommand = "bash -l -c `"$bashCommands`""
    if ($DryRun) {
        Write-Warn "[DryRun] SSH CMD: ssh $($sshArgs -join ' ') $remoteUserHost `"$wrappedCommand`""
        return 0
    }
    & $sshCmd.Path @sshArgs $remoteUserHost $wrappedCommand
    return $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# 2. Xu ly cac Action chi quan ly (khong can keo code)
# ---------------------------------------------------------------------------
switch ($Action) {
    "ssh" {
        Write-Step "Mo terminal SSH truc tiep toi $remoteUserHost (thu muc: $($Config.RemotePath))..."
        $interactiveCmd = "bash -l -c `"$targetDirBash && cd `"`$TARGET_DIR`" && exec bash -l`""
        & $sshCmd.Path -t @sshArgs $remoteUserHost $interactiveCmd
        exit $LASTEXITCODE
    }
    "logs" {
        Write-Step "Xem log tren server qua ./deploy.sh logs $Target..."
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh logs $Target"
        exit $LASTEXITCODE
    }
    "ps" {
        Write-Step "Trang thai tien trinh PM2 tren server:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh ps"
        exit $LASTEXITCODE
    }
    "doctor" {
        Write-Step "Kiem tra tinh trang he thong qua ./deploy.sh doctor:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh doctor"
        exit $LASTEXITCODE
    }
    "restart" {
        Write-Step "Khoi dong lai ung dung qua ./deploy.sh restart:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh restart"
        exit $LASTEXITCODE
    }
    "stop" {
        Write-Step "Tam dung ung dung qua ./deploy.sh stop:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh stop"
        exit $LASTEXITCODE
    }
    "seed" {
        Write-Step "Khoi tao tai khoan quan tri admin tren server qua ./deploy.sh seed:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh seed"
        exit $LASTEXITCODE
    }
    "backup" {
        Write-Step "Sao luu CSDL va du lieu uploads tren server qua ./deploy.sh backup:"
        Invoke-RemoteBash "$targetDirBash && cd `"`$TARGET_DIR`" && ./deploy.sh backup"
        exit $LASTEXITCODE
    }
}

# ---------------------------------------------------------------------------
# 3. Quy trinh Deploy: Dong bo Git Local -> Keo ve Server -> Chay deploy.sh
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Bat dau quy trinh deploy ($Action) qua Git len Home Server: $remoteUserHost"
Write-Host "      Kho ma nguon : $($Config.RepoUrl)"
Write-Host "      Nhanh git    : $($Config.Branch)"
Write-Host "      Thu muc dich : $($Config.RemotePath)"
Write-Host ""

# 3.1. Kiem tra va Day ma tu Local len GitHub (tru khi bat -SkipPush)
if (-not $SkipPush) {
    Push-Location $SCRIPT_ROOT
    try {
        Write-Step "Kiem tra trang thai Git tai may local..."
        $statusOutput = & $gitCmd.Path status -s
        if ($statusOutput) {
            Write-Step "Phat hien thay doi o local. Tien hanh commit..."
            & $gitCmd.Path add .
            & $gitCmd.Path commit -m "Auto commit truoc khi deploy ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
        }

        # Kiem tra xem co commit can push len remote hay khong
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
} else {
    Write-Warn "Bo qua buoc kiem tra/push Git o local (-SkipPush duoc bat)."
}

if ($DryRun) {
    Write-Success "[DryRun] Kiem tra hoan tat. Khong thuc hien lenh tren may chu."
    exit 0
}

# 3.2. Dieu khien Server dong bo ma tu GitHub va kich hoat deploy.sh
Write-Step "Ket noi Home Server de dong bo ma tu GitHub va trien khai..."

$gitSyncBash = @"
$targetDirBash
if [ ! -d "`$TARGET_DIR/.git" ]; then
    echo "==> Thu muc chua co Git. Dang clone tu GitHub..."
    mkdir -p "`$(dirname "`$TARGET_DIR")"
    git clone -b $($Config.Branch) $($Config.RepoUrl) "`$TARGET_DIR"
else
    echo "==> Cap nhat ma nguon tu GitHub (git fetch & reset)..."
    cd "`$TARGET_DIR"
    git fetch origin $($Config.Branch)
    git reset --hard origin/$($Config.Branch)
fi
cd "`$TARGET_DIR"
chmod +x deploy.sh
"@

if ($Action -eq "pull-only") {
    Invoke-RemoteBash "$gitSyncBash && echo ' ok  Da cap nhat ma nguon tu Git tren server.'"
    exit $LASTEXITCODE
}

$deployShCommand = ""
if ($Action -eq "up") {
    $deployShCommand = "./deploy.sh up"
} elseif ($Action -eq "update") {
    $deployShCommand = "./deploy.sh update"
}

$fullRemoteDeployBash = "$gitSyncBash && $deployShCommand"
Invoke-RemoteBash $fullRemoteDeployBash

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Success "Trien khai hoan tat thanh cong!"
} else {
    Write-Host ""
    Write-Warn "Qua trinh ket thuc voi ma loi $LASTEXITCODE. Xem log tren server: .\deploy.ps1 logs"
}
