[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
  Import-VstsLocStrings "$PSScriptRoot\task.json"

  # Get inputs.
  $input_source = Get-VstsInput -Name 'source' -Require
  $input_target = Get-VstsInput -Name 'destination' -Require

  # Execute utility script containing logic
  Invoke-Expression -Command $PSScriptRoot\utility.ps1 -Source $input_source -Destination $input_target
}
catch {

}

finally {
  Trace-VstsLeavingInvocation $MyInvocation
  $input_source = $null
  $input_target = $null
}