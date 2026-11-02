import type { BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export const FULLSCREEN_NATIVE = String.raw`using System;
using System.Runtime.InteropServices;

namespace Q {
  public static class W {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    public struct MonitorInfo {
      public int Size;
      public Rect Monitor, Work;
      public uint Flags;
    }

    [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    public static bool IsFullscreenWindow(IntPtr window) {
      if (window == IntPtr.Zero || window == GetShellWindow() || window == GetDesktopWindow()) return false;

      const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
      const int WS_DLGFRAME = 0x00400000, WS_THICKFRAME = 0x00040000;
      const int WS_EX_WINDOWEDGE = 0x00000100, WS_EX_TOOLWINDOW = 0x00000080;
      // Maximized framed windows can extend beyond the monitor's bounds.
      if ((GetWindowLong(window, GWL_STYLE) & (WS_DLGFRAME | WS_THICKFRAME)) != 0 ||
          (GetWindowLong(window, GWL_EXSTYLE) & (WS_EX_WINDOWEDGE | WS_EX_TOOLWINDOW)) != 0) return false;

      Rect bounds;
      if (!GetWindowRect(window, out bounds)) return false;
      IntPtr monitor = MonitorFromWindow(window, 0);
      var info = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
      const uint MONITORINFOF_PRIMARY = 1;
      if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info) ||
          (info.Flags & MONITORINFOF_PRIMARY) == 0) return false;

      return bounds.Left <= info.Monitor.Left && bounds.Top <= info.Monitor.Top &&
             bounds.Right >= info.Monitor.Right && bounds.Bottom >= info.Monitor.Bottom;
    }
  }
}
`

/** Notification state, own-window flag, and foreground fullscreen flag. */
export function parseFullscreenSample(line: string): boolean | undefined {
  const sample = /^([1-7]) ([01]) ([01])$/.exec(line)
  if (!sample) return undefined
  const [, state, ownWindow, fullscreenWindow] = sample
  // QUNS_BUSY (2) can be caused by our transparent overlay itself. Only
  // exclusive Direct3D (3) and presentation mode (4) are global hide signals.
  return ownWindow === '0' && (state === '3' || state === '4' || fullscreenWindow === '1')
}

/** Hide for foreground fullscreen apps, exclusive mode, or presentation mode. */
export function hideOnFullscreen(win: BrowserWindow): void {
  const pet = win.getNativeWindowHandle().readBigUInt64LE()
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
${FULLSCREEN_NATIVE}
'@
while ($true) {
  $state = 0
  $result = [Q.W]::SHQueryUserNotificationState([ref]$state)
  if ($result -lt 0) { throw "SHQueryUserNotificationState failed: $result" }
  $foreground = [Q.W]::GetForegroundWindow()
  [Console]::WriteLine("{0} {1} {2}", $state, [int]($foreground -eq [IntPtr]${pet}), [int][Q.W]::IsFullscreenWindow($foreground))
  Start-Sleep -Milliseconds 500
}
`
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  ps.on('error', error => console.error('Fullscreen monitor failed to start:', error))
  ps.stderr.on('data', data => console.error('Fullscreen monitor:', data.toString().trim()))
  let full = false
  const lines = createInterface({ input: ps.stdout })
  lines.on('line', line => {
    const next = parseFullscreenSample(line)
    if (next === undefined || next === full || win.isDestroyed()) return
    full = next
    if (full) win.hide()
    else win.showInactive()
  })
  win.on('closed', () => { lines.close(); ps.kill() })
}
