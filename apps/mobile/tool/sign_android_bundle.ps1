param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,

    [Parameter(Mandatory = $true)]
    [string]$KeystorePath,

    [string]$KeyAlias = 'qore-upload',

    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Convert-SecureStringToPlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Value)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not (Get-Command jarsigner -ErrorAction SilentlyContinue)) {
    throw 'jarsigner no está disponible. Instala un JDK antes de firmar el AAB.'
}

$bundle = (Resolve-Path -LiteralPath $BundlePath).Path
$keystore = (Resolve-Path -LiteralPath $KeystorePath).Path

if (-not $OutputPath) {
    $directory = Split-Path -Parent $bundle
    $OutputPath = Join-Path $directory 'qore-mobile-production-signed.aab'
}

if (Test-Path -LiteralPath $OutputPath) {
    throw "Ya existe $OutputPath. No se sobrescribirá."
}

$storePasswordSecure = Read-Host 'Contraseña del keystore de upload' -AsSecureString
$keyPasswordSecure = Read-Host 'Contraseña de la clave de upload' -AsSecureString
$storePassword = Convert-SecureStringToPlainText $storePasswordSecure
$keyPassword = Convert-SecureStringToPlainText $keyPasswordSecure

try {
    $env:QORE_ANDROID_STORE_PASSWORD = $storePassword
    $env:QORE_ANDROID_KEY_PASSWORD = $keyPassword

    & jarsigner `
        -keystore $keystore `
        '-storepass:env' QORE_ANDROID_STORE_PASSWORD `
        '-keypass:env' QORE_ANDROID_KEY_PASSWORD `
        -sigalg SHA256withRSA `
        -digestalg SHA-256 `
        -signedjar $OutputPath `
        $bundle `
        $KeyAlias

    if ($LASTEXITCODE -ne 0) {
        throw "jarsigner terminó con código $LASTEXITCODE"
    }

    & jarsigner -verify -verbose -certs $OutputPath | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw 'La verificación criptográfica del AAB firmado falló.'
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash.ToLowerInvariant()
    "$hash  $(Split-Path -Leaf $OutputPath)" |
        Set-Content -LiteralPath "$OutputPath.sha256" -Encoding ascii

    Write-Host ''
    Write-Host 'AAB firmado y verificado:'
    Write-Host $OutputPath
    Write-Host "SHA-256: $hash"
}
finally {
    Remove-Item Env:QORE_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:QORE_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue

    $storePassword = $null
    $keyPassword = $null
    $storePasswordSecure = $null
    $keyPasswordSecure = $null
}
