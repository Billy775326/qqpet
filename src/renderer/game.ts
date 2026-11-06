import { SwfPlayer } from './swf/player'
import { touch } from './ui/dom'
import { gamepad } from './ui/gamepad'

const swf = new URLSearchParams(location.search).get('swf')!
document.title = swf.replace(/^.*\//, '').replace(/\.swf$/, '')
const player = new SwfPlayer(document.body)
// The stage keeps its aspect and fills the window; whatever lies off stage is hidden behind the bars.
// Apply the volume before playback so the opening sound cannot start at full volume.
await player.load(`pet/game/${swf}`, undefined, { letterbox: 'on', autoplay: 'off' })
const playback = player.el.ruffle()
playback.volume = 0.3
playback.resume()
player.el.focus()
if (touch) gamepad(player.el, swf)
