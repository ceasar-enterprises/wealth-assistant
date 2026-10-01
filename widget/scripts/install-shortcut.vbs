' Wealth Command shortcut helper.
'
' Creates a Windows .lnk shortcut. Arguments:
'   0 = targetPath (exe or cmd)
'   1 = shortcut full path (*.lnk)
'   2 = working directory
'   3 = description (optional)
'   4 = window style (0 hidden, 1 normal, 7 minimized)
'
' Usage:  wscript.exe "install-shortcut.vbs" <target> <lnk> <workDir> [desc] [style]

Set ws = CreateObject("WScript.Shell")
On Error Resume Next
target = WScript.Arguments(0)
lnkPath = WScript.Arguments(1)
workDir = WScript.Arguments(2)
desc = ""
style = 1
If WScript.Arguments.Count > 3 Then desc = WScript.Arguments(3)
If WScript.Arguments.Count > 4 Then style = CInt(WScript.Arguments(4))

Set sc = ws.CreateShortcut(lnkPath)
sc.TargetPath = target
sc.WorkingDirectory = workDir
sc.WindowStyle = style
If Len(desc) > 0 Then sc.Description = desc
sc.Save
On Error GoTo 0

If Not ws.FileExists(lnkPath) Then
  WScript.StdOut.WriteLine "Failed to create " & lnkPath
  WScript.Quit 1
End If
WScript.StdOut.WriteLine "Created " & lnkPath
WScript.Quit 0