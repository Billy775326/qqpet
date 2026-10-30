import { petCanvasRect, petVisibleRect } from '../pet/geometry'
import { describe, type Good, type GoodType } from '../pet/data/goods'
import { listGoods, onGoodsChange, pageOf, type Page } from '../pet/goods'
import { doctor, pay, useItem } from '../pet/items'
import { describeStudy, describeWork, study, studyGoods, work, workGoods } from '../pet/jobs'
import { speak } from '../pet/pet'
import { info, onInfoChange, petSize, save } from '../pet/store'
import { openPinkDiamond } from '../pet/vip'
import './css/control.css'
import { formatDate } from './date'
import { button, div, img, touch } from './dom'
import { openEmail } from './email'
import { openFarm } from './farm'
import { openFishing } from './fishing'
import { openGames } from './games'
import { openMstx } from './mstx'
import { openPetInfo } from './petinfo'
import { progress } from './progress'
import { openSetup } from './setup'
import { openShop } from './shop'
import { openSignIn } from './signin'
import { setBubbleLift } from './talk'
import { openTask } from './task'
import { openTravel } from './travel'
import { windowView } from './window-view'

const ICONS = 'pet/control/icons/'
/** The goods panel, the bar's widest part. */
const BAR_WIDTH = 314
/** Pet size the bar was drawn for (level 1 on a 1920 px screen). */
const DESKTOP_PET = 150
const EDGE = 10
/** A finger needs longer than a mouse to find the next button. */
const HIDE_MS = touch ? 5000 : 1500
const PAGE = 4

type Stat = 'hunger' | 'clean' | 'health' | 'mood'

/** A list of goods to pick from, 4 per page. */
interface Panel {
  icon: string
  list: (page: number) => Page
  lines: (g: Good) => string[]
  /** Returns true when the panel should close. */
  use: (g: Good) => boolean
  /** Everyday panels: the inventory type shown, with the bar of the stat it restores and a shop link. */
  type?: GoodType
  stat?: Stat
}

interface Entry {
  name: string
  icon: string
  run: () => void
}

const activeIcon = (n: number): string => `${ICONS}active/${n}.svg`

const inventory = (type: GoodType, icon: number, stat: Stat) => (): void =>
  openPanel({
    icon: activeIcon(icon),
    list: (page) => listGoods(type, page, PAGE),
    lines: (g) => [...describe(g), `数量：${g.num}`],
    use: (g) => {
      useItem(g)
      return false
    },
    type,
    stat,
  })

const PANELS = {
  food: inventory('food', 18, 'hunger'),
  clean: inventory('clean', 20, 'clean'),
  medicine: inventory('medicine', 22, 'health'),
  toy: inventory('toy', 28, 'mood'),
}

function pinkDiamond(): void {
  const until = (): void => speak({ s: `[host],我们粉钻到${formatDate(info.PDiamondExpirationDate, 'YYYY-MM-DD HH:mm')}过期哦~`, now: true }, 'speak')
  if (info.pinkDiamond) return until()
  const first = info.PDgrowth === 0
  const price = first ? 666 : info.PDiamondLevel * 888
  windowView({
    title: '开通粉钻',
    msg: first ? '限时花费666（原价888）元宝，开通粉钻5天，机不可失！~~' : `开通粉钻需要${price}元宝，开通粉钻5天，助力宝宠成长玩耍~~`,
    ok: (close) => {
      if (!pay(price)) return
      openPinkDiamond(5)
      close()
      until()
    },
  })
}

/** A menu group opens its children on hover, or runs `run` on click. */
const MENU: { name: string; icon: string; children?: Entry[]; run?: () => void }[] = [
  {
    name: '日常',
    icon: 'richang.png',
    children: [
      { name: '食物', icon: 'weishi.png', run: PANELS.food },
      { name: '清洁', icon: 'qingjie.png', run: PANELS.clean },
      { name: '吃药', icon: 'zhibing.png', run: PANELS.medicine },
      { name: '玩具', icon: 'wanshua.png', run: PANELS.toy },
    ],
  },
  { name: '粉钻', icon: 'fenzhuan.png', run: pinkDiamond },
  {
    name: '交互',
    icon: 'chongwu.png',
    children: [
      {
        name: '打工',
        icon: 'dagong.png',
        run: () => openPanel({ icon: activeIcon(26), list: (page) => pageOf(workGoods(), page, PAGE), lines: describeWork, use: work }),
      },
      {
        name: '学习',
        icon: 'xuexi.png',
        run: () => openPanel({ icon: activeIcon(24), list: (page) => pageOf(studyGoods(), page, PAGE), lines: describeStudy, use: study }),
      },
      { name: '旅游', icon: 'lvyou.png', run: openTravel },
      { name: '看病', icon: 'zhibing.png', run: doctor },
    ],
  },
  {
    name: '工具',
    icon: 'renwu.png',
    children: [
      { name: '邮箱', icon: 'haoyou.png', run: openEmail },
      { name: '任务', icon: 'renwu1.png', run: openTask },
      { name: '签到', icon: 'juanzhou00.png', run: openSignIn },
      { name: '设置', icon: 'guanli.png', run: openSetup },
    ],
  },
  {
    name: '活动',
    icon: 'gonggao.png',
    children: [
      { name: '池塘', icon: 'fish01.png', run: openFishing },
      { name: '农场', icon: 'nongchang01.png', run: openFarm },
      { name: '游戏', icon: 'game.svg', run: openGames },
      { name: '密室', icon: 'mstx.png', run: openMstx },
    ],
  },
  { name: '档案', icon: 'dangan.png', run: openPetInfo },
]

const control = div('control')
control.dataset.hit = ''
document.body.appendChild(div('ui-control', control))

let shown = false
let hideTimer = 0
let introTimer = 0
let open: (Panel & { page: number }) | null = null

type Placement = 'left' | 'right' | 'above' | 'below'
const LOCAL_CONTROL_ITEM = 32;
const LOCAL_CONTROL_GAP = 0;
const LOCAL_FLYOUT_GAP = 2;
const LOCAL_PET_CONTROL_GAP = 10;
const LOCAL_SIDE_ENTER = 72;
const LOCAL_SIDE_EXIT = 96;
function place(): void {
  if(!shown){setBubbleLift(0);return;}
  // Actions can occupy the whole SWF canvas, beyond the standing silhouette.
  const frame=petCanvasRect(),size2=petSize();
  const body={left:Math.max(0,frame.left),top:Math.max(0,frame.top),right:Math.min(innerWidth,frame.right),bottom:Math.min(innerHeight,frame.bottom)};
  const clamp=(n: number,min: number,max: number)=>Math.max(min,Math.min(n,Math.max(min,max)));
  const normalScale=touch?size2/DESKTOP_PET:1;
  const length=menus.children.length*LOCAL_CONTROL_ITEM+(menus.children.length-1)*LOCAL_CONTROL_GAP;
  const silhouette=petVisibleRect();
  const edgeDistance=Math.min(silhouette.left,innerWidth-silhouette.right);
  const previousVertical=control.dataset.layout==="vertical";
  const nearSide=edgeDistance<=(previousVertical?LOCAL_SIDE_EXIT:LOCAL_SIDE_ENTER);
  const columnFits=length*normalScale<=innerHeight-2*EDGE;
  const rowFits=length*normalScale<=innerWidth-2*EDGE;
  const flyoutHeight=Math.max(0,...Array.from(menus.querySelectorAll<HTMLElement>(".childrenMenu"),e=>e.scrollHeight));
  const expandedFits=Math.max(body.top-EDGE,innerHeight-EDGE-body.bottom)>=(LOCAL_CONTROL_ITEM+flyoutHeight+LOCAL_FLYOUT_GAP+LOCAL_PET_CONTROL_GAP)*normalScale;
  const vertical=columnFits&&(nearSide||!rowFits||!expandedFits);
  control.dataset.layout=vertical?"vertical":"horizontal";
  control.classList.toggle("verticalControls",vertical);
  const width=open?list?.offsetWidth||BAR_WIDTH:menus.offsetWidth;
  const height=open?list?.offsetHeight||138:menus.offsetHeight;
  const scale=Math.min(normalScale,Math.max(1,innerWidth-2*EDGE)/width,Math.max(1,innerHeight-2*EDGE)/height);
  const w=width*scale,h=height*scale,spacing=LOCAL_PET_CONTROL_GAP*scale;
  const room={left:body.left-EDGE-spacing,right:innerWidth-EDGE-body.right-spacing,above:body.top-EDGE-spacing,below:innerHeight-EDGE-body.bottom-spacing};
  const sideOrder: Placement[]=room.right>=room.left?["right","left"]:["left","right"];
  const lineReserve=h+(!open&&!vertical?(flyoutHeight+LOCAL_FLYOUT_GAP)*scale:0);
  const lineOrder: Placement[]=room.below>=lineReserve?["below","above"]:room.above>=lineReserve?["above","below"]:room.below>=room.above?["below","above"]:["above","below"];
  const priorities=vertical?[...sideOrder,...lineOrder]:[...lineOrder,...sideOrder];
  let placement=priorities.find(side=>(side==="left"||side==="right")?room[side]>=w:room[side]>=h);
  // Very small work areas still retain a usable, clamped bar or goods panel.
  if(!placement)placement=priorities.reduce((best,side)=>room[side]>room[best]?side:best,priorities[0]);
  let x=(body.left+body.right-w)/2,y=(body.top+body.bottom-h)/2;
  if(placement==="right")x=body.right+spacing;
  if(placement==="left")x=body.left-spacing-w;
  if(placement==="below")y=body.bottom+spacing;
  if(placement==="above")y=body.top-spacing-h;
  x=clamp(x,EDGE,innerWidth-EDGE-w);y=clamp(y,EDGE,innerHeight-EDGE-h);
  control.style.left=x+w/2+"px";control.style.top=y+"px";
  control.style.transform="scale("+scale+")";
  control.style.setProperty("--local-control-text-width",Math.max(1,(innerWidth-2*EDGE)/scale)+"px");
  control.dataset.placement=placement;
  control.classList.toggle("abovePet",placement==="above");
  for(const parent of menus.querySelectorAll<HTMLElement>(".menuItem")){
    const child=parent.querySelector<HTMLElement>(".childrenMenu");if(!child)continue;
    child.style.left=child.style.right=child.style.top=child.style.bottom="auto";
    child.style.transform="none";child.style.padding="0";
    child.style.maxHeight=Math.max(1,(innerHeight-2*EDGE)/scale)+"px";
    const anchor=parent.getBoundingClientRect();
    const sideways=!vertical&&Math.max(anchor.top-EDGE,innerHeight-EDGE-anchor.bottom)<(child.offsetHeight+LOCAL_FLYOUT_GAP)*scale;
    if(vertical||sideways){
      const freeRight=innerWidth-EDGE-anchor.right,freeLeft=anchor.left-EDGE;
      const preferred=vertical?(placement==="right"?"right":"left"):(freeRight>=freeLeft?"right":"left");
      const toRight=preferred==="right"?freeRight>=(child.offsetWidth+LOCAL_FLYOUT_GAP)*scale||freeRight>=freeLeft:!(freeLeft>=(child.offsetWidth+LOCAL_FLYOUT_GAP)*scale||freeLeft>=freeRight);
      child.dataset.direction=toRight?"right":"left";
      child.style.top="0px";
      if(toRight){child.style.left="100%";child.style.paddingLeft=LOCAL_FLYOUT_GAP+"px";}
      else{child.style.right="100%";child.style.paddingRight=LOCAL_FLYOUT_GAP+"px";}
    }else{
      const up=anchor.top-EDGE,down=innerHeight-EDGE-anchor.bottom;
      const toUp=placement==="above"?up>=(child.offsetHeight+LOCAL_FLYOUT_GAP)*scale||up>=down:down<(child.offsetHeight+LOCAL_FLYOUT_GAP)*scale&&up>down;
      child.dataset.direction=toUp?"above":"below";
      if(toUp){child.style.bottom="100%";child.style.paddingBottom=LOCAL_FLYOUT_GAP+"px";}
      else{child.style.top="100%";child.style.paddingTop=LOCAL_FLYOUT_GAP+"px";}
      child.style.left=(parent.offsetWidth-child.offsetWidth)/2+"px";
    }
    const r=child.getBoundingClientRect();
    child.style.transform="translate("+(clamp(r.left,EDGE,innerWidth-EDGE-r.width)-r.left)/scale+"px,"+(clamp(r.top,EDGE,innerHeight-EDGE-r.height)-r.top)/scale+"px)";
  }
  for(const tip of menus.querySelectorAll<HTMLElement>(".menuTip")){
    tip.style.translate="none";
    const r=tip.getBoundingClientRect();if(!r.width||!r.height)continue;
    tip.style.translate=(clamp(r.left,EDGE,innerWidth-EDGE-r.width)-r.left)/scale+"px "+(clamp(r.top,EDGE,innerHeight-EDGE-r.height)-r.top)/scale+"px";
  }
  for(const tip of control.querySelectorAll<HTMLElement>(".goodInfo")){
    if(getComputedStyle(tip).display==="none")continue;
    tip.style.left="100%";tip.style.right="auto";tip.style.top="0px";tip.style.transform="none";
    tip.style.maxWidth=Math.max(1,(innerWidth-2*EDGE)/scale)+"px";
    tip.style.maxHeight=Math.max(1,(innerHeight-2*EDGE)/scale)+"px";
    if(tip.getBoundingClientRect().right>innerWidth-EDGE){tip.style.left="auto";tip.style.right="100%";}
    const r=tip.getBoundingClientRect();
    tip.style.transform="translate("+(clamp(r.left,EDGE,innerWidth-EDGE-r.width)-r.left)/scale+"px,"+(clamp(r.top,EDGE,innerHeight-EDGE-r.height)-r.top)/scale+"px)";
  }
  setBubbleLift(placement==="above"?Math.max(0,body.top-y):0);
}

/** A tap leaves its menu hovered, children shown: on touch the bar goes once a child is picked, unless it opened a goods panel. */
function pick(run: () => void): void {
  run()
  if (touch && !open) hide()
}

const icons: HTMLElement[] = []
const menus = div(
  'menus fcc',
  ...MENU.map((g) => {
    const icon = div('menuItemIconBox', img('menuItemIcon', ICONS + g.icon))
    icons.push(icon)
    const item = div(
      'menuItem fcc focusPress',
      div('menuTip', g.name),
      icon,
      ...(g.children
        ? [div('childrenMenu', ...g.children.map((c) => button('childrenMenuItem fc', () => pick(c.run), img('childrenMenuItemIcon', ICONS + c.icon), div('childrenMenuLabel', c.name))))]
        : []),
    )
    if (g.run) item.addEventListener('click', g.run)
    item.addEventListener('mouseenter', () => {
      clearTimeout(introTimer)
      highlight(-1)
      clearTimeout(hideTimer)
    })
    item.addEventListener('mouseleave', scheduleHide)
    return item
  }),
)
control.appendChild(menus)
control.addEventListener('pointerover', place)
control.addEventListener('pointerenter', () => clearTimeout(hideTimer))
control.addEventListener('pointerleave', scheduleHide)
window.addEventListener('resize', place)
window.addEventListener('qqpet:pet-layout', place)

const highlight = (n: number): void => icons.forEach((icon, i) => icon.classList.toggle('hoverMenuItemIcon', i === n))

/** Lights the menu icons up one after another when the bar appears. */
function intro(n = 0): void {
  highlight(n)
  if (n < icons.length) introTimer = window.setTimeout(() => intro(n + 1), 150)
}

/** Pressing the pet shows the bar. */
export function showControl(): void {
  if (save.isBury) return
  clearTimeout(hideTimer)
  if (shown) return
  shown = true
  control.classList.add('showControl')
  place()
  intro()
}

/** Shows the bar with an everyday goods panel open. */
export function openGoods(type: keyof typeof PANELS): void {
  showControl()
  PANELS[type]()
}

/** The bar hides 1.5 s (5 s on touch screens) after the pointer leaves it, unless an inventory panel is open. */
export function scheduleHide(): void {
  clearTimeout(hideTimer)
  if (open || control.matches(':hover')) return
  hideTimer = window.setTimeout(hide, HIDE_MS)
}

function hide(): void {
  shown = false
  control.classList.remove('showControl')
  place()
}

let list: HTMLElement | null = null

function openPanel(p: Panel, page = 1): void {
  open = { ...p, page }
  menus.style.display = 'none'
  const { list: goods, totalPage } = p.list(page)
  const turn = (d: number) => (): void => {
    if (page + d >= 1 && page + d <= totalPage) openPanel(p, page + d)
  }
  let picked: Good | null = null
  const items = goods.map((g: Good) =>
    div(
      'goodItem',
      div(
        'goodItemIconBox fcc',
        div('goodInfo', div('goodName', g.name), ...p.lines(g).map((l) => div('goodDatas', l))),
        Object.assign(img('goodItemIcon', g.url), {
          onclick: () => {
            // A tap hovers what it touches: the first one shows the good's info, the next uses it.
            if (touch && picked !== g) return void (picked = g)
            if (p.use(g)) closePanel()
          },
        }),
      ),
    ),
  )
  const next = div(
    'goodList focusPress',
    img('goodTypeIcon', p.icon),
    ...(p.stat ? [button('toShoppingMall', openShop, '去购物')] : []),
    button('goodClose', closePanel),
    div(
      'goodListMain fcc',
      button('toLeft', turn(-1)),
      div(
        'goods f1 fC h100',
        div('fc f1', ...(items.length ? items : [div('goodsNone tc w100', ' 空空如也~~ ')])),
        ...(p.stat ? [div('progress', progress(info[p.stat], save.petComputedlInfo[`${p.stat}Max`]))] : []),
      ),
      button('toRight', turn(1)),
    ),
  )
  if (list) list.replaceWith(next)
  else control.appendChild(next)
  list = next
  place()
}

function closePanel(): void {
  open = null
  list?.remove()
  list = null
  menus.style.display = ''
  place()
  scheduleHide()
}

onInfoChange((key) => {
  if (key === 'lastX' || key === 'lastY' || key === 'growth') place()
  if (open && key === open.stat) openPanel(open, open.page)
})
onGoodsChange((type) => {
  if (open?.type === type) openPanel(open, Math.min(open.page, Math.max(open.list(1).totalPage, 1)))
})
