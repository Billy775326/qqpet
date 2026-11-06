import { SwfPlayer } from './swf/player'
import { loadGame } from './swf/game-player'
import { touch } from './ui/dom'
import { gamepad } from './ui/gamepad'

const swf = new URLSearchParams(location.search).get('swf')!
document.title = swf.replace(/^.*\//, '').replace(/\.swf$/, '')
const player = new SwfPlayer(document.body)
// The stage keeps its aspect and fills the window; whatever lies off stage is hidden behind the bars.
await loadGame(player, `pet/game/${swf}`, undefined, { letterbox: 'on' })
player.el.focus()
if (touch) gamepad(player.el, swf)
