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
  if (measured.width !== width || measured.height !== height || measured.dpr !== deviceScaleFactor) {
    throw Error('Unexpected UI test viewport: ' + JSON.stringify({ requested: { width, height, deviceScaleFactor }, measured }))
  }
}

module.exports = { resizeViewport }
