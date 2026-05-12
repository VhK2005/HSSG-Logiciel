param(
  [string]$Owner = "VhK2005",
  [string]$Repo = "HSSG-Logiciel",
  [string]$Branch = "main",
  [string]$Message = "Publish Overview Reception Hotel",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function ConvertFrom-SecureStringPlainText {
  param([securestring]$SecureValue)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-RelativeUploadPath {
  param(
    [string]$Root,
    [string]$FullName
  )

  $relative = $FullName.Substring($Root.Length).TrimStart("\", "/")
  $relative.Replace("\", "/")
}

function Should-UploadFile {
  param([string]$RelativePath)

  if ($RelativePath -match "^(node_modules|dist|data|\.git)/") { return $false }
  if ($RelativePath -in @(".env")) { return $false }
  if ($RelativePath -like "*.log") { return $false }
  return $true
}

function Invoke-GitHub {
  param(
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $uri = "https://api.github.com$Path"
  $headers = @{
    Authorization          = "Bearer $script:Token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"           = "HSSGAPP-publish-script"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 20 -Compress
  Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -ContentType "application/json"
}

$root = (Get-Location).Path.TrimEnd("\", "/")
$files = Get-ChildItem -Path $root -File -Recurse -Force |
  ForEach-Object {
    [pscustomobject]@{
      FullName = $_.FullName
      Path     = Get-RelativeUploadPath -Root $root -FullName $_.FullName
    }
  } |
  Where-Object { Should-UploadFile -RelativePath $_.Path } |
  Sort-Object Path

Write-Host "Repository target: $Owner/$Repo ($Branch)"
Write-Host "Files to upload: $($files.Count)"

if ($DryRun) {
  $files | ForEach-Object { Write-Host " - $($_.Path)" }
  exit 0
}

if ($env:GITHUB_TOKEN) {
  $script:Token = $env:GITHUB_TOKEN
} else {
  Write-Host "Paste a GitHub token with Contents write access. It will not be displayed."
  $script:Token = ConvertFrom-SecureStringPlainText (Read-Host "GitHub token" -AsSecureString)
}

if (-not $script:Token) {
  throw "Missing GitHub token."
}

$repoFullName = "$Owner/$Repo"
$encodedRepo = "$Owner/$Repo"

Write-Host "Reading current branch..."
$ref = Invoke-GitHub -Method GET -Path "/repos/$encodedRepo/git/ref/heads/$Branch"
$parentSha = $ref.object.sha
$parentCommit = Invoke-GitHub -Method GET -Path "/repos/$encodedRepo/git/commits/$parentSha"
$baseTreeSha = $parentCommit.tree.sha
$currentTree = Invoke-GitHub -Method GET -Path "/repos/$encodedRepo/git/trees/$baseTreeSha`?recursive=1"

$trackedPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($file in $files) {
  [void]$trackedPaths.Add($file.Path)
}

$tree = New-Object System.Collections.Generic.List[object]

Write-Host "Creating blobs..."
$index = 0
foreach ($file in $files) {
  $index += 1
  Write-Progress -Activity "Uploading blobs" -Status $file.Path -PercentComplete (($index / $files.Count) * 100)
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $blob = Invoke-GitHub -Method POST -Path "/repos/$encodedRepo/git/blobs" -Body @{
    content  = [Convert]::ToBase64String($bytes)
    encoding = "base64"
  }

  $tree.Add(@{
    path = $file.Path
    mode = "100644"
    type = "blob"
    sha  = $blob.sha
  })
}
Write-Progress -Activity "Uploading blobs" -Completed

foreach ($item in $currentTree.tree) {
  if ($item.type -eq "blob" -and -not $trackedPaths.Contains($item.path)) {
    $tree.Add(@{
      path = $item.path
      mode = "100644"
      type = "blob"
      sha  = $null
    })
  }
}

Write-Host "Creating tree..."
$newTree = Invoke-GitHub -Method POST -Path "/repos/$encodedRepo/git/trees" -Body @{
  base_tree = $baseTreeSha
  tree      = $tree
}

Write-Host "Creating commit..."
$newCommit = Invoke-GitHub -Method POST -Path "/repos/$encodedRepo/git/commits" -Body @{
  message = $Message
  tree    = $newTree.sha
  parents = @($parentSha)
}

Write-Host "Updating branch..."
Invoke-GitHub -Method PATCH -Path "/repos/$encodedRepo/git/refs/heads/$Branch" -Body @{
  sha   = $newCommit.sha
  force = $false
} | Out-Null

Write-Host "Published $repoFullName@$Branch"
Write-Host "Commit: https://github.com/$repoFullName/commit/$($newCommit.sha)"
Write-Host "Next: in GitHub Settings > Pages, select GitHub Actions as the source if it is not already enabled."
