[Reading 71 lines from start (total: 71 lines, 0 remaining)]

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

        $terminalAvailable = $null -ne (Get-Process terminal64 -ErrorAction SilentlyContinue | Select-Object -First 1)
        $core = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -eq 'python.exe' -and $_.CommandLine -like '*qore_fundednext_runtime.py*'
        } | Select-Object -First 1

        $coreRoot = $null
        $coreMode = $null
        if ($null -ne $core) {
            $runtimeScript = $null
            if ($core.CommandLine -match '"(?<script>[A-Za-z]:\\[^\"]*qore_fundednext_runtime\.py)"') {
                $runtimeScript = $Matches['script']
            } elseif ($core.CommandLine -match '(?<script>[A-Za-z]:\\\S*qore_fundednext_runtime\.py)') {
                $runtimeScript = $Matches['script']
            }
            if (-not [string]::IsNullOrWhiteSpace($runtimeScript)) {
                $coreRoot = Split-Path -Parent (Split-Path -Parent $runtimeScript)
            }
            if ($core.CommandLine -match '--mode\s+(?<mode>live|shadow)') {
                $coreMode = $Matches['mode'].ToLowerInvariant()
            }
        }

        $bridgeProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -eq 'python.exe' -and $_.CommandLine -like '*vps_runtime_telemetry_bridge.py*'
        })

        $processHealthy = $bridgeProcesses.Count -eq 1
        if ($processHealthy -and $null -ne $coreRoot -and $null -ne $coreMode) {
            $bridgeCmd = $bridgeProcesses[0].CommandLine
            $rootOk = $bridgeCmd -like ('*--root ' + $coreRoot + '*')
            $modeOk = $bridgeCmd -like ('*--mode ' + $coreMode + '*')
            $processHealthy = $rootOk -and $modeOk
        } else {
            $processHealthy = $false
        }

        $needsRecovery = $sequenceStale -or -not $processHealthy
        if ($needsRecovery -and $terminalAvailable -and $null -ne $core) {
            if ($task.State -eq 'Running') {
                Stop-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            }
            foreach ($process in $bridgeProcesses) {
                Invoke-CimMethod -InputObject $process -MethodName Terminate -ErrorAction SilentlyContinue | Out-Null
            }
            Start-Sleep -Seconds 1
            Start-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
        }
    } catch {
    }
    Start-Sleep -Seconds ([Math]::Max(2, $CheckEverySeconds))
}

[executed on device: vps-vrix (dc465c7d-1698-4cb8-921f-a008b11315c7)]