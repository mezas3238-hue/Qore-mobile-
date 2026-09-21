param(
    [string]$BridgeTaskName = 'QORE Mobile Telemetry Bridge',
    [string]$SequenceFile = 'C:\ProgramData\QOREMobileBridge\sequence.txt',
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

        $terminalAvailable = $null -ne (
            Get-Process terminal64 -ErrorAction SilentlyContinue |
                Select-Object -First 1
        )
        $bridgeProcesses = @(
            Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -eq 'python.exe' -and
                    $_.CommandLine -like '*vps_runtime_telemetry_bridge.py*'
                }
        )
        $processHealthy = $bridgeProcesses.Count -eq 1
        $needsRecovery = $sequenceStale -or -not $processHealthy

        if ($needsRecovery -and $terminalAvailable) {
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
        # Fail closed: the watchdog has no trading authority and only attempts
        # to restore the read-only mobile telemetry task.
    }

    Start-Sleep -Seconds ([Math]::Max(2, $CheckEverySeconds))
}
