# Self-contained native Windows build: no missing helper scripts from the upstream repository.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$QtPrefix, [string]$CavalryRoot = '')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Build=Join-Path $Root 'build\windows-injector'
$QtPrefix=[IO.Path]::GetFullPath($QtPrefix)
function Run([string]$Command,[string[]]$Arguments) {
  & $Command @Arguments
  if($LASTEXITCODE -ne 0){throw "$Command failed with exit code $LASTEXITCODE"}
}
Push-Location $Root
try {
  if(-not(Test-Path (Join-Path $QtPrefix 'lib\cmake\Qt6'))){throw 'Qt 6.6.3 MSVC x64 shared SDK is required.'}
  Run 'node' @('tools/prepare_runtime.js')
  Run 'node' @('tools/generate_quick_add_descriptions.js')
  $args=@('-S','injector/windows','-B',$Build,'-A','x64','-T','v143',"-DCMAKE_PREFIX_PATH=$QtPrefix",'-DBUILD_TESTING=ON')
  if($CavalryRoot){$args+= "-DCAVALRY_VENDOR_ROOT=$([IO.Path]::GetFullPath($CavalryRoot))"}
  Run 'cmake' $args
  Run 'cmake' @('--build',$Build,'--config','Release','--parallel')
  $oldPath=$env:PATH
  try {$env:PATH="$(Join-Path $QtPrefix 'bin');$oldPath";Run 'ctest' @('--test-dir',$Build,'-C','Release','--output-on-failure')}
  finally {$env:PATH=$oldPath}
  foreach($entry in @(@('generic','cavalryi18n.dll'),@('qpa','qwindows.dll'))) {
    $source=Join-Path (Join-Path $Build $entry[0]) $entry[1]
    if(-not(Test-Path $source)){throw "Missing artifact: $source"}
    $dest=Join-Path $Root ("dist\windows\"+$entry[0]);New-Item -ItemType Directory -Force $dest | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $dest $entry[1]) -Force
  }
  Write-Host 'DLL compilation and fixture tests finished. This is NOT Cavalry host acceptance.'
} finally {Pop-Location}
