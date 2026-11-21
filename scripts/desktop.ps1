param([Parameter(Mandatory=$true)][string]$Action, [string]$Payload = 'e30=')
$ErrorActionPreference = 'Stop'
$inputData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class JarvisNative {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from, uint to, bool attach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr handle);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left; public int top; public int right; public int bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle, out RECT rect);
  public static bool FocusWindow(IntPtr handle) {
    uint ignored;
    uint current = GetCurrentThreadId();
    uint foreground = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
    uint target = GetWindowThreadProcessId(handle, out ignored);
    try {
      if(current != foreground) AttachThreadInput(current, foreground, true);
      if(current != target) AttachThreadInput(current, target, true);
      ShowWindow(handle, 9); BringWindowToTop(handle); SetForegroundWindow(handle);
      return GetForegroundWindow() == handle;
    } finally {
      if(current != target) AttachThreadInput(current, target, false);
      if(current != foreground) AttachThreadInput(current, foreground, false);
    }
  }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion data; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion {
    [FieldOffset(0)] public KEYBDINPUT keyboard;
    [FieldOffset(0)] public MOUSEINPUT mouse;
  }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort key; public ushort scan; public uint flags; public uint time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int x; public int y; public uint mouseData; public uint flags; public uint time; public UIntPtr extra; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
  public static void TypeText(string text) {
    foreach(char c in text.Replace("\r\n", "\n").Replace("\r", "\n")) {
      var down = new INPUT(); down.type = 1;
      down.data.keyboard = new KEYBDINPUT();
      if(c == '\n' || c == '\t') { down.data.keyboard.key = (ushort)(c == '\n' ? 13 : 9); }
      else { down.data.keyboard.scan = c; down.data.keyboard.flags = 4; }
      var up = down; up.data.keyboard.flags |= 2;
      if(SendInput(2, new INPUT[] { down, up }, Marshal.SizeOf(typeof(INPUT))) != 2)
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}
'@
switch ($Action) {
  'status' {
    $screen = [Windows.Forms.SystemInformation]::VirtualScreen
    $cursor = [Windows.Forms.Cursor]::Position
    $windows = @(Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object {
      $rect = New-Object JarvisNative+RECT
      [JarvisNative]::GetWindowRect($_.MainWindowHandle,[ref]$rect) | Out-Null
      @{ Id=$_.Id; ProcessName=$_.ProcessName; MainWindowTitle=$_.MainWindowTitle; bounds=@{x=$rect.left;y=$rect.top;width=($rect.right-$rect.left);height=($rect.bottom-$rect.top)} }
    })
    @{ platform = 'Windows'; computer = $env:COMPUTERNAME; screen = @{ x=$screen.X; y=$screen.Y; width=$screen.Width; height=$screen.Height }; cursor=@{x=$cursor.X;y=$cursor.Y}; windows=$windows } | ConvertTo-Json -Depth 5 -Compress
  }
  'screenshot' {
    $bounds = [Windows.Forms.SystemInformation]::VirtualScreen
    $bitmap = New-Object Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $stream = New-Object IO.MemoryStream
    try {
      $graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)
      $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Jpeg)
      @{ image = [Convert]::ToBase64String($stream.ToArray()); mimeType = 'image/jpeg'; x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height } | ConvertTo-Json -Compress
    } finally { $graphics.Dispose(); $bitmap.Dispose(); $stream.Dispose() }
  }
  'open_app' {
    $apps = @{ notepad='notepad.exe'; calculator='calc.exe'; explorer='explorer.exe'; edge='msedge.exe'; chrome='chrome.exe'; vscode='code'; paint='mspaint.exe'; terminal='wt.exe'; spotify='spotify.exe' }
    if (!$apps.ContainsKey([string]$inputData.app)) { throw 'Aplikasi tidak diizinkan.' }
    Start-Process -FilePath $apps[[string]$inputData.app]
    @{ ok=$true; app=$inputData.app } | ConvertTo-Json -Compress
  }
  'open_url' {
    $uri = [Uri]$inputData.url
    if ($uri.Scheme -notin @('https','http')) { throw 'URL harus HTTP atau HTTPS.' }
    Start-Process -FilePath $uri.AbsoluteUri
    @{ ok=$true; url=$uri.AbsoluteUri } | ConvertTo-Json -Compress
  }
  'pointer' {
    $screen = [Windows.Forms.SystemInformation]::VirtualScreen
    $x=[int]$inputData.x; $y=[int]$inputData.y
    if (!$screen.Contains($x,$y)) { throw 'Posisi di luar layar.' }
    if (![JarvisNative]::SetCursorPos($x,$y)) { throw 'Windows menolak perpindahan pointer.' }
    if ($inputData.click) {
      [JarvisNative]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
      [JarvisNative]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
    }
    @{ok=$true;x=$x;y=$y;clicked=[bool]$inputData.click} | ConvertTo-Json -Compress
  }
  'focus_window' {
    $process = Get-Process -Id ([int]$inputData.id)
    if (!$process.MainWindowHandle) { throw 'Window tidak ditemukan.' }
    $focused = [JarvisNative]::FocusWindow($process.MainWindowHandle)
    if (!$focused) {
      $shell = New-Object -ComObject WScript.Shell
      $focused = $shell.AppActivate($process.Id)
    }
    if (!$focused) { throw 'Windows menolak fokus window. Klik window tujuan sekali dan coba lagi.' }
    @{ok=$focused;title=$process.MainWindowTitle} | ConvertTo-Json -Compress
  }
  'type_text' {
    # Literal Unicode input without changing the user's clipboard.
    [JarvisNative]::TypeText([string]$inputData.text)
    @{ok=$true;characters=([string]$inputData.text).Length} | ConvertTo-Json -Compress
  }
  'key' {
    $keys=@{ WIN='^{ESC}'; ENTER='{ENTER}'; TAB='{TAB}'; ESC='{ESC}'; BACKSPACE='{BACKSPACE}'; UP='{UP}'; DOWN='{DOWN}'; LEFT='{LEFT}'; RIGHT='{RIGHT}'; CTRL_A='^a'; CTRL_C='^c'; CTRL_V='^v'; CTRL_S='^s'; CTRL_L='^l'; CTRL_Z='^z'; ALT_TAB='%{TAB}'; PAGE_DOWN='{PGDN}'; PAGE_UP='{PGUP}' }
    if (!$keys.ContainsKey([string]$inputData.key)) { throw 'Tombol tidak diizinkan.' }
    [Windows.Forms.SendKeys]::SendWait($keys[[string]$inputData.key])
    @{ok=$true;key=$inputData.key} | ConvertTo-Json -Compress
  }
  default { throw 'Tindakan desktop tidak dikenal.' }
}
