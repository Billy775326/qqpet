/** Decode both original assets before swapping in a pet animation. */
export const originalCursorsReady = Promise.all(['normal', 'press'].map(name => {
  const image = new Image()
  image.src = new URL(`pet/img_res/hand/focus/${name}.cur`, document.baseURI).href
  return image.decode()
})).catch(error => console.warn('Could not preload original QQPet cursors', error))

export function installPetCursor(player: HTMLElement): void {
  const root = player.shadowRoot
  if (!root || root.querySelector('style[data-qqpet-original-cursor]')) return
  const style = document.createElement('style')
  style.dataset.qqpetOriginalCursor = ''
  // Ruffle resets inherited cursors; custom properties cross its shadow boundary.
  style.textContent = ':host,#container,canvas{cursor:var(--qqpet-original-pet-cursor,default)!important}'
  root.append(style)
}
