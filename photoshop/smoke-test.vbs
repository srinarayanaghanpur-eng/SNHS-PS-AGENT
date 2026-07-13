Option Explicit

Const RPC_E_SERVERCALL_RETRYLATER = -2147417846
Const MAX_ATTEMPTS = 15

Dim psApp, jsxPath, outputPath, resultPath, logPath, fso
Dim attempt, errorNumber, errorDescription

jsxPath = WScript.Arguments(0)
outputPath = CreateObject("WScript.Shell").Environment("PROCESS")("SNHS_SMOKE_OUTPUT")
Set fso = CreateObject("Scripting.FileSystemObject")

If Len(outputPath) = 0 Then
  WScript.Echo "BRIDGE_SETUP_FAILED: SNHS_SMOKE_OUTPUT is not set"
  WScript.Quit 10
End If

If Not fso.FolderExists(outputPath) Then fso.CreateFolder outputPath
resultPath = fso.BuildPath(outputPath, "result.json")
logPath = fso.BuildPath(outputPath, "smoke-bridge.log")

' A stale result must never be mistaken for this run's outcome.
On Error Resume Next
If fso.FileExists(resultPath) Then fso.DeleteFile resultPath, True
If fso.FileExists(logPath) Then fso.DeleteFile logPath, True
On Error GoTo 0

LogMessage "stage=connect action=GetObject"
On Error Resume Next
Set psApp = GetObject(, "Photoshop.Application")
errorNumber = Err.Number
errorDescription = Err.Description
On Error GoTo 0

If errorNumber <> 0 Then
  LogMessage "stage=connect GetObject_failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  LogMessage "stage=connect action=CreateObject"
  On Error Resume Next
  Err.Clear
  Set psApp = CreateObject("Photoshop.Application")
  errorNumber = Err.Number
  errorDescription = Err.Description
  On Error GoTo 0
End If

If errorNumber <> 0 Then
  WriteFailure "com-connect", 0, errorNumber, errorDescription
  WScript.Echo "COM_CONNECT_FAILED: " & HResult(errorNumber) & " " & errorDescription
  WScript.Quit 20
End If

If Not IsObject(psApp) Then
  WriteFailure "com-connect", 0, 0, "Photoshop.Application did not return an automation object"
  WScript.Echo "COM_CONNECT_FAILED: Photoshop.Application did not return an automation object"
  WScript.Quit 21
End If

LogMessage "stage=connected wait_seconds=5"
WScript.Sleep 5000

On Error Resume Next
Err.Clear
psApp.Visible = True
errorNumber = Err.Number
errorDescription = Err.Description
On Error GoTo 0
If errorNumber <> 0 Then
  If errorNumber = RPC_E_SERVERCALL_RETRYLATER Then
    LogMessage "stage=set-visible result=busy action=defer-to-jsx-retry hresult=" & HResult(errorNumber)
  Else
    WriteFailure "set-visible", 0, errorNumber, errorDescription
    WScript.Echo "SET_VISIBLE_FAILED: " & HResult(errorNumber) & " " & errorDescription
    WScript.Quit 22
  End If
End If

For attempt = 1 To MAX_ATTEMPTS
  LogMessage "stage=DoJavaScriptFile attempt=" & attempt & " of=" & MAX_ATTEMPTS
  On Error Resume Next
  Err.Clear
  psApp.DoJavaScriptFile jsxPath
  errorNumber = Err.Number
  errorDescription = Err.Description
  On Error GoTo 0

  If errorNumber = 0 Then
    LogMessage "stage=DoJavaScriptFile attempt=" & attempt & " result=accepted"
    WScript.Echo "JSX_EXECUTION_RETURNED attempt=" & attempt
    WScript.Quit 0
  End If

  LogMessage "stage=DoJavaScriptFile attempt=" & attempt & " result=failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  If errorNumber <> RPC_E_SERVERCALL_RETRYLATER Then
    WriteFailure "jsx-execution", attempt, errorNumber, errorDescription
    WScript.Echo "JSX_EXECUTION_FAILED: attempt=" & attempt & " hresult=" & HResult(errorNumber) & " " & errorDescription
    WScript.Quit 30
  End If

  If attempt < MAX_ATTEMPTS Then
    LogMessage "stage=DoJavaScriptFile attempt=" & attempt & " action=busy-retry wait_seconds=2"
    WScript.Sleep 2000
  End If
Next

WriteFailure "jsx-execution-busy-timeout", MAX_ATTEMPTS, errorNumber, errorDescription
WScript.Echo "JSX_BUSY_TIMEOUT: attempts=" & MAX_ATTEMPTS & " hresult=" & HResult(errorNumber) & " " & errorDescription
WScript.Quit 31

Sub LogMessage(message)
  Dim stream
  Set stream = fso.OpenTextFile(logPath, 8, True, 0)
  stream.WriteLine Now & " " & message
  stream.Close
  WScript.Echo message
End Sub

Sub WriteFailure(stage, failedAttempt, number, details)
  Dim stream, payload
  payload = "{""success"":false,""stage"":""" & JsonEscape(stage) & _
    """,""attempt"":" & failedAttempt & _
    ",""hresult"":""" & JsonEscape(HResult(number)) & _
    """,""errorNumber"":" & number & _
    ",""details"":""" & JsonEscape(details) & """}"
  Set stream = fso.OpenTextFile(resultPath, 2, True, 0)
  stream.Write payload
  stream.Close
  LogMessage "stage=" & stage & " failure_json=" & resultPath
End Sub

Function HResult(number)
  If number = RPC_E_SERVERCALL_RETRYLATER Then
    HResult = "0x8001010A"
  Else
    HResult = CStr(number)
  End If
End Function

Function JsonEscape(value)
  Dim escaped
  escaped = CStr(value)
  escaped = Replace(escaped, "\", "\\")
  escaped = Replace(escaped, Chr(34), "\" & Chr(34))
  escaped = Replace(escaped, vbCr, "\r")
  escaped = Replace(escaped, vbLf, "\n")
  JsonEscape = escaped
End Function
