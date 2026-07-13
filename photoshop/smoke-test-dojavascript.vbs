Option Explicit

Const RPC_E_SERVERCALL_RETRYLATER = -2147417846
Const MAX_ATTEMPTS = 10

Dim psApp, jsxPath, normalizedPath, command, outputPath, logPath, fso
Dim attempt, errorNumber, errorDescription, connectedBy

jsxPath = WScript.Arguments(0)
outputPath = CreateObject("WScript.Shell").Environment("PROCESS")("SNHS_SMOKE_OUTPUT")
Set fso = CreateObject("Scripting.FileSystemObject")

If Len(outputPath) = 0 Then
  WScript.Echo "SETUP_FAILED: SNHS_SMOKE_OUTPUT is not set"
  WScript.Quit 10
End If

If Not fso.FolderExists(outputPath) Then fso.CreateFolder outputPath
logPath = fso.BuildPath(outputPath, "smoke-dojavascript.log")
If fso.FileExists(logPath) Then fso.DeleteFile logPath, True

normalizedPath = Replace(jsxPath, "\", "/")
normalizedPath = Replace(normalizedPath, "'", "\'")
command = "$.evalFile(new File('" & normalizedPath & "'));"

LogMessage "stage=connect action=GetObject jsx=" & normalizedPath
On Error Resume Next
Set psApp = GetObject(, "Photoshop.Application")
errorNumber = Err.Number
errorDescription = Err.Description
On Error GoTo 0

If errorNumber <> 0 Then
  LogMessage "stage=connect action=GetObject result=failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  LogMessage "stage=connect action=CreateObject"
  On Error Resume Next
  Err.Clear
  Set psApp = CreateObject("Photoshop.Application")
  errorNumber = Err.Number
  errorDescription = Err.Description
  On Error GoTo 0
  connectedBy = "CreateObject"
Else
  connectedBy = "GetObject"
End If

If errorNumber <> 0 Or Not IsObject(psApp) Then
  LogMessage "stage=connect result=failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  WScript.Quit 20
End If
LogMessage "stage=connect result=success transport=" & connectedBy

On Error Resume Next
Err.Clear
psApp.Visible = True
errorNumber = Err.Number
errorDescription = Err.Description
On Error GoTo 0
If errorNumber <> 0 Then
  LogMessage "stage=set-visible result=failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  If errorNumber <> RPC_E_SERVERCALL_RETRYLATER Then WScript.Quit 21
Else
  LogMessage "stage=set-visible result=success"
End If

For attempt = 1 To MAX_ATTEMPTS
  LogMessage "stage=DoJavaScript attempt=" & attempt & " of=" & MAX_ATTEMPTS
  On Error Resume Next
  Err.Clear
  psApp.DoJavaScript command
  errorNumber = Err.Number
  errorDescription = Err.Description
  On Error GoTo 0

  If errorNumber = 0 Then
    LogMessage "stage=DoJavaScript attempt=" & attempt & " result=accepted final=success"
    WScript.Echo "DOJAVASCRIPT_ACCEPTED attempt=" & attempt
    WScript.Quit 0
  End If

  LogMessage "stage=DoJavaScript attempt=" & attempt & " result=failed hresult=" & HResult(errorNumber) & " details=" & errorDescription
  If errorNumber <> RPC_E_SERVERCALL_RETRYLATER Then
    LogMessage "stage=DoJavaScript final=failure reason=unrelated-error"
    WScript.Quit 30
  End If
  If attempt < MAX_ATTEMPTS Then WScript.Sleep 2000
Next

LogMessage "stage=DoJavaScript attempt=" & MAX_ATTEMPTS & " final=failure reason=busy-timeout hresult=0x8001010A"
WScript.Quit 31

Sub LogMessage(message)
  Dim stream, line
  line = IsoTimestamp(Now) & " " & message
  Set stream = fso.OpenTextFile(logPath, 8, True, 0)
  stream.WriteLine line
  stream.Close
  WScript.Echo line
End Sub

Function HResult(number)
  If number = RPC_E_SERVERCALL_RETRYLATER Then
    HResult = "0x8001010A"
  Else
    HResult = CStr(number)
  End If
End Function

Function IsoTimestamp(value)
  IsoTimestamp = Year(value) & "-" & Right("0" & Month(value), 2) & "-" & _
    Right("0" & Day(value), 2) & "T" & Right("0" & Hour(value), 2) & ":" & _
    Right("0" & Minute(value), 2) & ":" & Right("0" & Second(value), 2)
End Function
