import type { SwfPlayer } from './player'

/** Only players opened from the Games panel share this initial volume. */
export async function loadGame(player: SwfPlayer, url: string, base?: string, options: Record<string, unknown> = {}): Promise<void> {
  // Set the volume before the movie can play its opening sound.
  await player.load(url, base, { ...options, autoplay: 'off' })
  const playback = player.el.ruffle()
  playback.volume = 0.3
  playback.resume()
}
