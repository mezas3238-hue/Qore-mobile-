param(
    [string]$BridgeTaskName = 'QORE Mobile cTrader Demo Bridge',
    [string]$SequenceFile = 'C:\ProgramData\QOREMobileBridge\ctrader-sequence.txt',
    [int]$CheckEverySeconds = 5,
    [int]$StaleAfterSeconds = 20
)

$ErrorActionPreference = 'Continue'

while ($true) {
    try {
        $task = Get-ScheduledTask -TaskName $BridgeTaskName -ErrorAction Stop
        $sequenceItem = Get-Item -LiteralPath $SequenceFile -ErrorAction SilentlyContinue
        $sequenceStale = $true
        if ($null -ne $sequenceItem) {
            $age = ((Get-Date) - $sequenceItem.LastWriteTime).TotalSeconds
            $sequenceStale = $age -gt $StaleAfterSeconds
        }

        $runtimeAvailable = $null -ne (
            Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -eq 'python.exe' -and
                    $_.CommandLine -like '*qore_ctrader_demo_free_runtime.py*'
                } |
                Select-Object -First 1
        )
        $bridgeProcesses = @(
            Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -eq 'python.exe' -and
                    $_.CommandLine -like '*ctrader_demo_mobile_telemetry_bridge.py*'
                }
        )
        $processHealthy = $bridgeProcesses.Count -eq 1

        if (($sequenceStale -or -not $processHealthy) -and $runtimeAvailable) {
            if ($task.State -eq 'Running') {
                Stop-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
            foreach ($process in $bridgeProcesses) {
                Invoke-CimMethod -InputObject $process -MethodName Terminate -ErrorAction SilentlyContinue |
                    Out-Null
            }
            Start-Sleep -Seconds 1
            Start-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
        }
    } catch {
        # Read-only recovery only. No cTrader mutation authority is present here.
    }

    Start-Sleep -Seconds ([Math]::Max(2, $CheckEverySeconds))
}
