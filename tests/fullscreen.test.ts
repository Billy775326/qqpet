import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { FULLSCREEN_NATIVE, parseFullscreenSample } from '../src/main/fullscreen.ts'

test('a busy notification state caused by the overlay never toggles visibility', () => {
  // Observed while the same maximized editor stayed in the foreground:
  // showing the pet produced state 2; hiding it produced state 5.
  for (const state of [2, 5, 2, 5, 2, 5]) {
    assert.equal(parseFullscreenSample(`${state} 0 0`), false)
  }
})

test('a fullscreen foreground window remains hidden independently of busy state', () => {
  for (const state of [2, 5, 2, 5]) {
    assert.equal(parseFullscreenSample(`${state} 0 1`), true)
  }
  assert.equal(parseFullscreenSample('5 0 0'), false, 'leaving fullscreen restores the pet')
})

test('exclusive fullscreen and presentation mode hide the pet but its own window does not', () => {
  assert.equal(parseFullscreenSample('3 0 0'), true)
  assert.equal(parseFullscreenSample('4 0 0'), true)
  for (const state of [2, 3, 4, 5]) {
    assert.equal(parseFullscreenSample(`${state} 1 1`), false)
  }
})

test('invalid monitor output cannot change visibility', () => {
  for (const line of ['', 'warning', '2', '2 0', '2 0 0 extra', '2 0 false', '0 0 1', '8 0 1']) {
    assert.equal(parseFullscreenSample(line), undefined)
  }
})

test('native Windows probe distinguishes borderless fullscreen from framed and partial windows', {
  skip: process.platform !== 'win32',
}, () => {
  // Hidden native windows exercise the real Win32 geometry and style checks
  // without stealing focus or interrupting the user's foreground application.
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${FULLSCREEN_NATIVE}
'@
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
try {
  $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $form.Bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  if (-not [Q.W]::IsFullscreenWindow($form.Handle)) { throw 'Borderless fullscreen was missed' }
  $form.Width = [int]($form.Width / 2)
  if ([Q.W]::IsFullscreenWindow($form.Handle)) { throw 'Partial window was treated as fullscreen' }
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
  $form.Bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  if ([Q.W]::IsFullscreenWindow($form.Handle)) { throw 'Framed window was treated as fullscreen' }
  if ([Q.W]::IsFullscreenWindow([IntPtr]::Zero)) { throw 'Missing foreground was treated as fullscreen' }
  if ([Q.W]::IsFullscreenWindow([Q.W]::GetShellWindow())) { throw 'Desktop was treated as fullscreen' }
  Write-Output 'Native fullscreen checks passed'
} finally { $form.Dispose() }
`
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, timeout: 20_000,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Native fullscreen checks passed/)
})
