const { screen } = require('electron')

/** Use an exact CSS viewport at the test window's current display scale.
 * Native window sizes can round differently under fractional Windows DPI.
 */
async function resizeViewport(win, width, height, requestedScale) {
  const deviceScaleFactor = requestedScale ?? screen.getDisplayMatching(win.getBounds()).scaleFactor
  win.setContentSize(width, height)
  const debuggerApi = win.webContents.debugger
  if (!debuggerApi.isAttached()) debuggerApi.attach('1.3')
  await debuggerApi.sendCommand('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor, mobile: false,
  })
  await new Promise(resolve => setTimeout(resolve, 80))
  const measured = await win.webContents.executeJavaScript('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})')
  // Native windows can report DPR 1 as 1.0000000149 after zoom emulation.
  if (measured.width !== width || measured.height !== height || Math.abs(measured.dpr - deviceScaleFactor) > 1e-6) {
    throw Error('Unexpected UI test viewport: ' + JSON.stringify({ requested: { width, height, deviceScaleFactor }, measured }))
  }
}

module.exports = { resizeViewport }
