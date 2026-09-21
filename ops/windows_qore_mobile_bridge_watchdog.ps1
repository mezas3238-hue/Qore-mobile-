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

        if (($task.State -ne 'Running' -or $sequenceStale) -and $terminalAvailable) {
            if ($task.State -eq 'Running') {
                Stop-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
            Start-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
        }
    } catch {
        # Fail closed: the watchdog has no trading authority and only attempts
        # to restore the read-only mobile telemetry task.
    }

    Start-Sleep -Seconds ([Math]::Max(2, $CheckEverySeconds))
}
