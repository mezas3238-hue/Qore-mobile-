param(
    [string]$Root = 'C:\QORE_CTRADER_DEMO_FREE',
    [string]$Python = 'C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe',
    [string]$Bridge = 'C:\QORE_MOBILE_BRIDGE_SRC\ops\ctrader_demo_mobile_telemetry_bridge.py',
    [string]$GatewayUrl = 'https://qore-mobile-gateway-production.up.railway.app',
    [string]$RuntimeId = 'vps-vrix-ctrader-demo-free',
    [string]$AccountId = 'ctrader-demo-free',
    [string]$SecretFile = 'C:\ProgramData\QOREMobileBridge\ctrader-runtime-secret.txt',
    [string]$SequenceFile = 'C:\ProgramData\QOREMobileBridge\ctrader-sequence.txt',
    [string]$LogFile = 'C:\ProgramData\QOREMobileBridge\ctrader-bridge.log'
)

$ErrorActionPreference = 'Continue'

while ($true) {
    $runtime = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq 'python.exe' -and
            $_.CommandLine -like '*qore_ctrader_demo_free_runtime.py*' -and
            $_.CommandLine -like '*--mode demo*'
        } |
        Select-Object -First 1

    if ($null -eq $runtime) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT cTrader DEMO runtime not running"
        Start-Sleep -Seconds 5
        continue
    }

    $state = Join-Path $Root 'var\ctrader_demo_signal_runtime\runtime-state.json'
    if (-not (Test-Path -LiteralPath $state)) {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT cTrader DEMO state missing"
        Start-Sleep -Seconds 5
        continue
    }

    try {
        . (Join-Path $Root 'scripts\load_ctrader_demo_credentials.ps1')
        $env:PYTHONPATH = "$Root\src;$Root\scripts"
    } catch {
        Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) WAIT cTrader DEMO credentials unavailable"
        Start-Sleep -Seconds 5
        continue
    }

    Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) START root=$Root mode=demo"

    & $Python $Bridge --root $Root --gateway-url $GatewayUrl --runtime-id $RuntimeId --account-id $AccountId --secret-file $SecretFile --sequence-file $SequenceFile --interval 2 2>&1 |
        ForEach-Object { Add-Content -LiteralPath $LogFile -Value $_ }

    $code = $LASTEXITCODE
    Add-Content -LiteralPath $LogFile -Value "$((Get-Date).ToString('o')) EXIT=$code; restarting in 5s"
    Start-Sleep -Seconds 5
}
