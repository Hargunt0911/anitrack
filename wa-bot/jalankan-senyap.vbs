' Jalankan AniTrack WA Bot 100% TERSEMBUNYI di background (tanpa jendela CMD & tanpa buka browser)
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

botDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = botDir

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
  nodeExe = "node"
End If

' Jalankan senyap (windowStyle = 0 -> tersembunyi penuh, tidak muncul di taskbar)
WshShell.Run """" & nodeExe & """ index.js", 0, False
