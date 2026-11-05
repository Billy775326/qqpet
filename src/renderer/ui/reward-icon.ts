/** Clean cutouts for reward icons whose original bitmaps have an opaque white matte.
 * Resolve at display time so rewards already stored in old saves also use the cutouts. */
const CUTOUTS = new Map([
  ['pet/img_res/toy/t0002.png', 'pet/img_res/rewards/t0002.png'],
  ['pet/img_res/toy/t0008.png', 'pet/img_res/rewards/t0008.png'],
  ['pet/img_res/food/100010061.gif', 'pet/img_res/rewards/100010061.png'],
])

export function rewardIcon(url: string): string {
  return CUTOUTS.get(url.replace(/^(?:\.\/|\/)/, '')) ?? url
}
