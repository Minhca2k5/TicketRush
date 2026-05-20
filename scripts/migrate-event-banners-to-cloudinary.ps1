param(
    [string]$EnvFile = ".env",
    [string]$PostgresService = "postgres",
    [string]$EventService = "event-service",
    [string]$DatabaseUser = "minh",
    [string]$DatabaseName = "ticketrush"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing environment file: $Path"
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $name, $value = $line.Split("=", 2)
        $values[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-Sha1Hex {
    param([string]$Text)

    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $sha1.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
}

function Invoke-CloudinaryUpload {
    param(
        [string]$Source,
        [bool]$IsLocalFile,
        [int]$EventId,
        [string]$CloudName,
        [string]$ApiKey,
        [string]$ApiSecret,
        [string]$Folder
    )

    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
    $publicId = "event-$EventId-banner"
    $signedParams = [ordered]@{
        folder = $Folder
        overwrite = "true"
        public_id = $publicId
        timestamp = $timestamp
    }

    $signatureBase = ($signedParams.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $signature = Get-Sha1Hex "$signatureBase$ApiSecret"

    if ($IsLocalFile) {
        $fileField = "file=@$Source"
    } else {
        $fileField = "file=$Source"
    }

    $body = & curl.exe -s -X POST "https://api.cloudinary.com/v1_1/$CloudName/image/upload" `
        -F $fileField `
        -F "api_key=$ApiKey" `
        -F "timestamp=$timestamp" `
        -F "signature=$signature" `
        -F "folder=$Folder" `
        -F "public_id=$publicId" `
        -F "overwrite=true"

    if ($LASTEXITCODE -ne 0) {
        throw "Cloudinary upload request failed for event $EventId"
    }

    $json = $body | ConvertFrom-Json
    if ($json.error) {
        throw "Cloudinary upload failed for event $EventId`: $($json.error.message)"
    }
    if (-not $json.secure_url) {
        throw "Cloudinary upload did not return secure_url for event $EventId"
    }

    return $json.secure_url
}

function Invoke-PostgresScalarQuery {
    param([string]$Sql)

    docker compose exec -T $PostgresService psql -U $DatabaseUser -d $DatabaseName -At -F "`t" -c $Sql
}

function Update-EventBannerUrl {
    param(
        [int]$EventId,
        [string]$Url
    )

    $escapedUrl = $Url.Replace("'", "''")
    $sql = "update events set image_url = '$escapedUrl', banner_url = '$escapedUrl' where id = $EventId;"
    docker compose exec -T $PostgresService psql -U $DatabaseUser -d $DatabaseName -q -c $sql | Out-Null
}

$envValues = Read-DotEnv $EnvFile
$cloudName = $envValues["CLOUDINARY_CLOUD_NAME"]
$apiKey = $envValues["CLOUDINARY_API_KEY"]
$apiSecret = $envValues["CLOUDINARY_API_SECRET"]
$folder = $envValues["CLOUDINARY_FOLDER"]

if (-not $folder) {
    $folder = "ticketrush/event-banners"
}

if (-not $cloudName -or -not $apiKey -or -not $apiSecret) {
    throw "Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET in $EnvFile"
}

$tempDir = Join-Path (Get-Location) ".cloudinary-migration-tmp"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

try {
    $rows = Invoke-PostgresScalarQuery "select id, coalesce(nullif(banner_url, ''), nullif(image_url, '')) as banner_url from events where coalesce(nullif(banner_url, ''), nullif(image_url, '')) is not null order by id;"
    $migrated = @()

    foreach ($row in $rows) {
        if (-not $row.Trim()) {
            continue
        }

        $parts = $row -split "`t", 2
        $eventId = [int]$parts[0]
        $currentUrl = $parts[1]

        if ($currentUrl -match "https://res\.cloudinary\.com/$([regex]::Escape($cloudName))/") {
            Write-Host "skip event $eventId - already Cloudinary"
            continue
        }

        $isLocalFile = $false
        $uploadSource = $currentUrl

        if ($currentUrl -match "/api/events/uploads/event-banners/([^/?#]+)") {
            $filename = $Matches[1]
            $localCopy = Join-Path $tempDir $filename
            docker compose cp "$EventService`:/app/uploads/event-banners/$filename" $localCopy | Out-Null
            $uploadSource = $localCopy
            $isLocalFile = $true
        }

        Write-Host "upload event $eventId"
        $cloudinaryUrl = Invoke-CloudinaryUpload `
            -Source $uploadSource `
            -IsLocalFile $isLocalFile `
            -EventId $eventId `
            -CloudName $cloudName `
            -ApiKey $apiKey `
            -ApiSecret $apiSecret `
            -Folder $folder

        Update-EventBannerUrl -EventId $eventId -Url $cloudinaryUrl
        $migrated += [pscustomobject]@{
            eventId = $eventId
            oldUrl = $currentUrl
            cloudinaryUrl = $cloudinaryUrl
        }

        Write-Host "updated event $eventId -> $cloudinaryUrl"
    }

    $resultPath = Join-Path (Get-Location) "cloudinary-banner-migration-result.json"
    $migrated | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    Write-Host "migration result written to $resultPath"
} finally {
    $resolvedTempDir = (Resolve-Path -LiteralPath $tempDir).Path
    $workspace = (Resolve-Path -LiteralPath (Get-Location)).Path
    if ($resolvedTempDir.StartsWith($workspace)) {
        Remove-Item -LiteralPath $resolvedTempDir -Recurse -Force
    }
}
