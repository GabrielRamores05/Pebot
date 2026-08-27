<#
.SYNOPSIS
  pebot — the one command for this project (Windows/PowerShell).

.DESCRIPTION
  Two halves:
    pebot init | spec ...   spec-driven development, via GitHub Spec Kit (`specify`)
    pebot dev  | db  | ...  project ops, via the npm scripts in my-app\

  Install once (see docs\pebot-cli.md) and it works from any directory:
  `pebot init` scaffolds into the folder you are standing in, and the ops
  commands find the project root by walking up from the current directory.
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Command,
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$Integrations = @('claude', 'kilocode', 'opencode')

function Die([string]$Message) { [Console]::Error.WriteLine("pebot: $Message"); exit 1 }

# Walk up from the current directory looking for the project root.
function Find-Root {
  $dir = (Get-Location).Path
  while ($dir) {
    if ((Test-Path (Join-Path $dir 'my-app\package.json')) -or (Test-Path (Join-Path $dir '.specify'))) {
      return $dir
    }
    $parent = Split-Path $dir -Parent
    if ($parent -eq $dir) { break }
    $dir = $parent
  }
  return $null
}

function Get-AppDir {
  $root = Find-Root
  if (-not $root) { Die "not inside the Pebot repo (no my-app\package.json or .specify\ above $(Get-Location))" }
  $app = Join-Path $root 'my-app'
  if (-not (Test-Path $app)) { Die "found $root but no my-app\ inside it" }
  return $app
}

function Require-Specify {
  if (-not (Get-Command specify -ErrorAction SilentlyContinue)) {
    Die "'specify' not found. Install it with: uv tool install specify-cli --from git+https://github.com/github/spec-kit.git"
  }
}

function Invoke-Npm([string[]]$NpmArgs) {
  Push-Location (Get-AppDir)
  try { & npm run @NpmArgs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
  finally { Pop-Location }
}

function Invoke-Init([string[]]$InitArgs) {
  Require-Specify
  # --here: scaffold into the current directory, whichever one that is.
  & specify init --here --force --integration $Integrations[0] @InitArgs
  foreach ($extra in $Integrations[1..($Integrations.Count - 1)]) {
    & specify integration install $extra --force
  }
  & specify integration use $Integrations[0]
}

function Invoke-Db([string[]]$DbArgs) {
  switch ($DbArgs[0]) {
    'generate' { Invoke-Npm @('db:generate') }
    'push'     { Invoke-Npm @('db:push') }
    'seed'     { Invoke-Npm @('db:seed') }
    'studio'   { Invoke-Npm @('db:studio') }
    'migrate'  {
      $sub = if ($DbArgs.Count -gt 1) { $DbArgs[1] } else { 'deploy' }
      Push-Location (Get-AppDir)
      try { & npx prisma migrate $sub } finally { Pop-Location }
    }
    default { Die "unknown db command '$($DbArgs[0])'. Try: generate, push, seed, studio, migrate" }
  }
}

# Runs all three gates even if an earlier one fails, so one run tells you
# everything that is wrong instead of only the first thing.
function Invoke-Check {
  Push-Location (Get-AppDir)
  $failed = @()
  try {
    & npm run lint;      if ($LASTEXITCODE -ne 0) { $failed += 'lint' }
    & npx tsc --noEmit;  if ($LASTEXITCODE -ne 0) { $failed += 'typecheck' }
    & npm run test:unit; if ($LASTEXITCODE -ne 0) { $failed += 'tests' }
  } finally { Pop-Location }
  if ($failed.Count -gt 0) {
    [Console]::Error.WriteLine("`npebot check: FAILED ($($failed -join ', '))")
    exit 1
  }
  "`npebot check: all gates passed"
}

function Invoke-Doctor {
  function Version($exe, $fallback) {
    if (Get-Command $exe -ErrorAction SilentlyContinue) { (& $exe --version) -join ' ' } else { $fallback }
  }
  "node         {0}" -f (Version 'node' 'MISSING')
  "npm          {0}" -f (Version 'npm' 'MISSING')
  "specify      {0}" -f (Version 'specify' 'MISSING (spec commands unavailable)')
  $root = Find-Root
  "repo root    {0}" -f ($(if ($root) { $root } else { 'NOT FOUND (run from inside the repo)' }))
  if ($root) {
    "constitution {0}" -f ($(if (Test-Path (Join-Path $root '.specify\memory\constitution.md')) { 'present' } else { 'MISSING' }))
    "node_modules {0}" -f ($(if (Test-Path (Join-Path $root 'my-app\node_modules')) { 'present' } else { 'MISSING (run: npm install in my-app)' }))
    $specs = @(Get-ChildItem (Join-Path $root 'specs') -Directory -ErrorAction SilentlyContinue)
    "specs        {0} found" -f $specs.Count
  }
  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $port = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    "port 3000    {0}" -f ($(if ($port) { 'IN USE' } else { 'free' }))
  }
}

function Show-Usage {
  @'
pebot - CafeOS project command

Spec-driven development (GitHub Spec Kit under the hood):
  pebot init [specify flags]   scaffold/refresh SDD in the current directory,
                               with the claude, kilocode and opencode integrations
  pebot spec <args...>         pass anything straight through to `specify`
                               e.g. pebot spec integration list

Project ops (run from anywhere inside the repo):
  pebot dev                    start the local dev server
  pebot build                  next build
  pebot build:electron         package the Windows desktop app
  pebot db generate|push|seed|studio|migrate [name]
  pebot check                  lint + typecheck + unit tests
  pebot doctor                 environment sanity check

The workflow itself is documented in AGENTS.md and .specify\memory\constitution.md;
this CLI is only a convenience over them.
'@
}

switch ($Command) {
  'init'           { Invoke-Init $Rest }
  'spec'           { Require-Specify; & specify @Rest }
  'dev'            { Invoke-Npm @('dev') }
  'build'          { Invoke-Npm @('build') }
  'build:electron' { Invoke-Npm @('electron:build:win') }
  'db'             { Invoke-Db $Rest }
  'check'          { Invoke-Check }
  'doctor'         { Invoke-Doctor }
  { $_ -in @('', $null, 'help', '-h', '--help') } { Show-Usage }
  default          { Die "unknown command '$Command'. Run 'pebot --help'." }
}
