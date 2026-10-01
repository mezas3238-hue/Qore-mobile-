param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$GatewayUrl,

    [Parameter(Mandatory = $true)]
    [string]$KeystorePath,

    [Parameter(Mandatory = $false)]
    [string]$KeyAlias = 'qore-upload'
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

$resolvedKeystore = (Resolve-Path -LiteralPath $KeystorePath).Path
$storePasswordSecure = Read-Host 'Contraseña del keystore de subida' -AsSecureString
$keyPasswordSecure = Read-Host 'Contraseña de la clave de subida' -AsSecureString

$storePassword = Convert-SecureStringToPlainText $storePasswordSecure
$keyPassword = Convert-SecureStringToPlainText $keyPasswordSecure

$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

try {
    $env:QORE_ANDROID_KEYSTORE_PATH = $resolvedKeystore
    $env:QORE_ANDROID_STORE_PASSWORD = $storePassword
    $env:QORE_ANDROID_KEY_ALIAS = $KeyAlias
    $env:QORE_ANDROID_KEY_PASSWORD = $keyPassword

    Push-Location $mobileRoot
    try {
        flutter pub get
        flutter build appbundle --release "--dart-define=QORE_GATEWAY_URL=$GatewayUrl"

        $bundle = Join-Path $mobileRoot 'build\app\outputs\bundle\release\app-release.aab'
        if (-not (Test-Path -LiteralPath $bundle)) {
            throw 'El AAB firmado no fue generado.'
        }

        Write-Host ''
        Write-Host 'QORE Mobile Android release generado correctamente:'
        Write-Host $bundle
        Write-Host 'Las contraseñas no se escribieron en GitHub ni en archivos del proyecto.'
    }
    finally {
        Pop-Location
    }
}
finally {
    Remove-Item Env:QORE_ANDROID_KEYSTORE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:QORE_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:QORE_ANDROID_KEY_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:QORE_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue

    $storePassword = $null
    $keyPassword = $null
    $storePasswordSecure = $null
    $keyPasswordSecure = $null
}
