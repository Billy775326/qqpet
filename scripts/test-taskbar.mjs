import { build } from 'esbuild'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'win32' || !process.argv.includes('--allow-taskbar-changes')) {
  throw Error('Windows only. Pass --allow-taskbar-changes to test and restore taskbar auto-hide and cursor position.')
}
mkdirSync(resolve('dist'),{recursive:true})
const directory=mkdtempSync(resolve('dist/desktop-workarea-'))
await build({entryPoints:['src/main/window.ts'],bundle:true,platform:'node',format:'esm',outfile:join(directory,'window.mjs'),external:['electron'],define:{'import.meta.dirname':JSON.stringify(resolve('out/main'))}})
writeFileSync(join(directory,'phase.txt'),'starting')
const quote=value=>"'"+value.replaceAll("'","''")+"'"
const NATIVE_SOURCE=String.raw`using System;
using System.Runtime.InteropServices;
public static class TaskbarProbe {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] public struct AppBarData { public uint Size; public IntPtr Window; public uint Callback,Edge; public Rect Bounds; public IntPtr Param; }
 [StructLayout(LayoutKind.Sequential)] public struct MonitorInfo { public int Size; public Rect Bounds,Work; public uint Flags; }
 [DllImport("shell32.dll")] static extern UIntPtr SHAppBarMessage(uint message,ref AppBarData data);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string name,string title);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr monitor,ref MonitorInfo info);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window,uint message,IntPtr w,IntPtr l);
 static AppBarData Data() {return new AppBarData {Size=(uint)Marshal.SizeOf(typeof(AppBarData)),Window=FindWindow("Shell_TrayWnd",null)};}
 public static uint State() {var data=Data();return (uint)SHAppBarMessage(4,ref data).ToUInt64();}
 public static void SetState(uint state) {var data=Data();if(data.Window==IntPtr.Zero)throw new Exception("Taskbar is unavailable");data.Param=new IntPtr(state);SHAppBarMessage(10,ref data);}
 public static AppBarData Position() {var data=Data();SHAppBarMessage(5,ref data);GetWindowRect(data.Window,out data.Bounds);return data;}
 public static void Move(bool edge) {
  var bar=Position();var monitor=new MonitorInfo{Size=Marshal.SizeOf(typeof(MonitorInfo))};
  if(!GetMonitorInfo(MonitorFromWindow(bar.Window,2),ref monitor))throw new Exception("Taskbar monitor is unavailable");
  var r=monitor.Bounds;int x=(r.Left+r.Right)/2,y=(r.Top+r.Bottom)/2;
  if(edge){if(bar.Edge==0)x=r.Left;if(bar.Edge==1)y=r.Top;if(bar.Edge==2)x=r.Right-1;if(bar.Edge==3)y=r.Bottom-1;}
  SetCursorPos(x,y);
 }
}`
const script=`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
NATIVE_SOURCE
'@
[void][TaskbarProbe]::SetProcessDPIAware()
$directory = CASE_DIRECTORY
$originalState = [TaskbarProbe]::State()
$originalCursor = New-Object TaskbarProbe+Point
[void][TaskbarProbe]::GetCursorPos([ref]$originalCursor)
$phases = @()
$process = $null
$ready = $null
try {
 Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
 Remove-Item Env:ELECTRON_RENDERER_URL -ErrorAction SilentlyContinue
 $process = Start-Process -FilePath ELECTRON_PATH -ArgumentList PROBE_ARGUMENTS -WindowStyle Hidden -RedirectStandardOutput (Join-Path $directory 'stdout.log') -RedirectStandardError (Join-Path $directory 'stderr.log') -PassThru
 for($attempt=0;$attempt -lt 80;$attempt++){
  if(Test-Path -LiteralPath (Join-Path $directory 'ready.json')) {break}
  if($process.HasExited){throw 'Desktop test app exited before becoming ready'}
  Start-Sleep -Milliseconds 100
 }
 $ready = Get-Content -LiteralPath (Join-Path $directory 'ready.json') -Raw | ConvertFrom-Json
 foreach($item in @(@{Name='visible';State=($originalState -band 0xfffffffe);Edge=$false},@{Name='hidden';State=($originalState -bor 1);Edge=$false},@{Name='revealed';State=($originalState -bor 1);Edge=$true},@{Name='hidden-again';State=($originalState -bor 1);Edge=$false},@{Name='visible-again';State=($originalState -band 0xfffffffe);Edge=$false})){
  [System.IO.File]::WriteAllText((Join-Path $directory 'phase.txt'),$item.Name)
  $start=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  [TaskbarProbe]::SetState([uint32]$item.State)
  [TaskbarProbe]::Move([bool]$item.Edge)
  Start-Sleep -Milliseconds 2500
  $state=[TaskbarProbe]::State()
  if(($state -band 1) -ne ($item.State -band 1)){throw 'Taskbar did not apply the requested auto-hide state'}
  $position=[TaskbarProbe]::Position()
  $monitorCount=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($ready.processId)" | Where-Object {$_.Name -eq 'powershell.exe'}).Count
  $phases += @{Name=$item.Name;Start=$start;State=$state;Edge=$position.Edge;Taskbar=$position.Bounds;MonitorCount=$monitorCount}
 }
} finally {
 [TaskbarProbe]::SetState($originalState)
 [void][TaskbarProbe]::SetCursorPos($originalCursor.X,$originalCursor.Y)
 [System.IO.File]::WriteAllText((Join-Path $directory 'phase.txt'),'restored')
 Start-Sleep -Milliseconds 1200
 $restored=[TaskbarProbe]::State()
 $restoredPoint=New-Object TaskbarProbe+Point
 [void][TaskbarProbe]::GetCursorPos([ref]$restoredPoint)
 $cursorRestored=($restoredPoint.X -eq $originalCursor.X -and $restoredPoint.Y -eq $originalCursor.Y)
 $phases | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory 'phases.json') -Encoding UTF8
 @{OriginalState=$originalState;RestoredState=$restored;CursorRestored=$cursorRestored} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'restored.json') -Encoding UTF8
 if($ready){[void][TaskbarProbe]::PostMessage([IntPtr]::new([long]$ready.handle),0x0010,[IntPtr]::Zero,[IntPtr]::Zero)}
 if($process -and -not $process.WaitForExit(8000)){Stop-Process -Id $process.Id}
 if(($restored -band 1) -ne ($originalState -band 1)){throw 'Original taskbar state was not restored'}
}
`.replace('NATIVE_SOURCE',NATIVE_SOURCE).replace('CASE_DIRECTORY',quote(directory))
 .replace('ELECTRON_PATH',quote(resolve('node_modules/electron/dist/electron.exe')))
 .replace('PROBE_ARGUMENTS',quote('"'+resolve('tests/desktop/workarea.mjs')+'" "'+directory+'"'))
writeFileSync(join(directory,'controller.ps1'),script)
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:55000})
if(result.stdout)process.stdout.write(result.stdout)
if(result.stderr)process.stderr.write(result.stderr)
if(result.error||result.status!==0)throw result.error??Error('Taskbar controller failed: '+result.status+'; evidence: '+directory)
const json=file=>JSON.parse(readFileSync(join(directory,file),'utf8').replace(/^\uFEFF/,''))
const {samples}=json('samples.json'),phases=json('phases.json'),restored=json('restored.json')
const summary=phases.map(phase=>{
 const rows=samples.filter(s=>s.phase===phase.Name&&s.at>=phase.Start+700)
 return {phase:phase.Name,autoHide:Boolean(phase.State&1),samples:rows.length,visible:rows.filter(s=>s.visible).length,mismatchedBounds:rows.filter(s=>{
   const a=s.workArea,b=s.bounds,expected={x:a.x+3,y:a.y+3,width:a.width-6,height:a.height-6}
   return b.x<a.x||b.y<a.y||b.x+b.width>a.x+a.width||b.y+b.height>a.y+a.height||['x','y','width','height'].some(k=>Math.abs(b[k]-expected[k])>2)
  }).length,monitorAlive:phase.MonitorCount===1,workArea:rows.at(-1)?.workArea,taskbar:phase.Taskbar}
})
const sameRect=(a,b)=>['Left','Top','Right','Bottom'].every(k=>Math.abs(a[k]-b[k])<=1)
const hoverRevealed=sameRect(summary.find(p=>p.phase==='revealed').taskbar,summary.find(p=>p.phase==='visible').taskbar)&&!sameRect(summary.find(p=>p.phase==='hidden').taskbar,summary.find(p=>p.phase==='visible').taskbar)
const passed=summary.length===5&&summary.every(p=>p.samples>=10&&p.visible===p.samples&&p.mismatchedBounds===0&&p.monitorAlive)&&hoverRevealed&&restored.CursorRestored&&(restored.OriginalState&1)===(restored.RestoredState&1)
const report={status:passed?'passed':'failed',directory,summary,hoverRevealed,restored,note:'Actual primary Windows desktop taskbar states; current monitor and system scale only.'}
writeFileSync(resolve('dist/desktop-workarea-results.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
if(!passed)process.exitCode=1
