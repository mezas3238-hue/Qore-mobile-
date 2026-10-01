param(
    [string]$OutputDirectory = (Join-Path $HOME '.qore-mobile-signing'),
    [string]$KeyAlias = 'qore-upload'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw 'keytool no está disponible. Instala un JDK antes de generar la upload key.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$keystore = Join-Path $OutputDirectory 'qore-upload.jks'

if (Test-Path -LiteralPath $keystore) {
    throw "Ya existe un keystore en $keystore. No se sobrescribirá."
}

Write-Host 'QORE Mobile - generación local de Google Play upload key'
Write-Host 'Las contraseñas serán solicitadas por keytool y no se guardarán en GitHub.'
Write-Host ''

& keytool `
    -genkeypair `
    -v `
    -keystore $keystore `
    -storetype JKS `
    -alias $KeyAlias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -dname 'CN=QORE Mobile Upload, O=QORE'

if ($LASTEXITCODE -ne 0) {
    throw "keytool terminó con código $LASTEXITCODE"
}

Write-Host ''
Write-Host 'Upload keystore creado localmente:'
Write-Host $keystore
Write-Host ''
Write-Host 'Guarda una copia privada. No lo subas a GitHub, Railway, Drive público ni al VPS de trading.'
