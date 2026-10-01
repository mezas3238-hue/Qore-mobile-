param(
    [string]$Python = 'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe',
    [string]$Bridge = 'C:\QORE_MOBILE_BRIDGE_SRC\ops\vps_runtime_telemetry_bridge.py',
    [string]$GatewayUrl = 'https://qore-mobile-gateway-production.up.railway.app',
    [string]$RuntimeId = 'vps-vrix-fundednext-shadow',
    [string]$AccountId = '921dad4adf2956a3ca597ae82a47d75a74735df86f90b3d01ef2456c3136cc8b',
    [string]$SecretFile = 'C:\ProgramData\QOREMobileBridge\runtime-secret.txt',
    [string]$SequenceFile = 'C:\ProgramData\QOREMobileBridge\sequence.txt',
    [string]$LogFile = 'C:\ProgramData\QOREMobileBridge\bridge.log'
)

$ErrorActionPreference = 'Continue'

while ($true) {
    $terminal = Get-Process terminal64 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $terminal) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT terminal64.exe not running"
        Start-Sleep -Seconds 5
        continue
    }

    $core = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq 'python.exe' -and
            $_.CommandLine -like '*qore_fundednext_runtime.py*'
        } |
        Select-Object -First 1

    if ($null -eq $core) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT QORE runtime not found"
        Start-Sleep -Seconds 5
        continue
    }

    $runtimeScript = $null
    if ($core.CommandLine -match '"(?<script>[A-Za-z]:\\[^\"]*qore_fundednext_runtime\.py)"') {
        $runtimeScript = $Matches['script']
    } elseif ($core.CommandLine -match '(?<script>[A-Za-z]:\\\S*qore_fundednext_runtime\.py)') {
        $runtimeScript = $Matches['script']
    }

    $runtimeMode = 'shadow'
    if ($core.CommandLine -match '--mode\s+(?<mode>live|shadow)') {
        $runtimeMode = $Matches['mode'].ToLowerInvariant()
    }

    if ([string]::IsNullOrWhiteSpace($runtimeScript)) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT unable to resolve runtime root"
        Start-Sleep -Seconds 5
        continue
    }

    $runtimeRoot = Split-Path -Parent (Split-Path -Parent $runtimeScript)
    $runtimeState = Join-Path $runtimeRoot 'var\fundednext\runtime-state.json'
    if (-not (Test-Path -LiteralPath $runtimeState)) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT runtime state missing root=$runtimeRoot"
        Start-Sleep -Seconds 5
        continue
    }

    Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) START root=$runtimeRoot mode=$runtimeMode"

    & $Python $Bridge --root $runtimeRoot --gateway-url $GatewayUrl --runtime-id $RuntimeId --account-id $AccountId --secret-file $SecretFile --sequence-file $SequenceFile --mode $runtimeMode --interval 2 2>&1 |
        ForEach-Object { Add-Content -LiteralPath $LogFile -Value $_ }

    $code = $LASTEXITCODE
    Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) EXIT=$code; restarting in 5s"
    Start-Sleep -Seconds 5
}
