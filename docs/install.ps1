# cursor-presence installer
#   irm https://voidzxcdev.github.io/cursor-presence/install.ps1 | iex

& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072

  $release = 'https://github.com/voidzxcdev/cursor-presence/releases/latest/download/cursor-presence.zip'

  function Test-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    return [int]((node -v).TrimStart('v').Split('.')[0]) -ge 20
  }

  $freshNode = $false
  if (-not (Test-Node)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      Write-Host 'Node.js 20 or newer is required: https://nodejs.org' -ForegroundColor Red
      return
    }
    Write-Host 'Installing Node.js LTS...'
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (Test-Node)) {
      Write-Host 'Node.js was installed. Open a new terminal and run the command again.' -ForegroundColor Yellow
      return
    }
    $freshNode = $true
  }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('cursor-presence-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Write-Host 'Downloading cursor-presence...'
    Invoke-WebRequest $release -OutFile "$tmp\cursor-presence.zip" -UseBasicParsing
    Expand-Archive "$tmp\cursor-presence.zip" $tmp -Force
    node "$tmp\setup.cjs" install
  } finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }

  if ($freshNode) { Write-Host 'Restart Cursor once so it picks up Node.js.' -ForegroundColor Yellow }
}
