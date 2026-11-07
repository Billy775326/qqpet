/**
 * Today's face pokes, trips, goods eaten, cleaned with and played with, shifts, lessons, games and minutes of games;
 * Travel2: provinces visited since the tour was last finished.
 */
export type Counter = 'Amusing' | 'Travel1' | 'Eat' | 'Clean' | 'Toy' | 'Work' | 'Study' | 'GameRound' | 'Game' | 'Travel2'
export type Tab = 'daily' | 'ddw' | 'growth' | 'travel'

export interface Task {
  label: string
  msg: string
  obj: Counter
  num: number
  /** City tasks stay taken across days. */
  keep?: boolean
  /** Rerolled every day: that many random goods, besides `good`. */
  reroll?: number
  good?: string[]
}

export const DDW = '点击逗乐点位'
export const TASKS: Record<Exclude<Tab, 'daily'>, Task[]> = {
  ddw: [
    { label: '逗逗我~~', msg: DDW, obj: 'Amusing', num: 5, good: ['_102010001*1'] },
    { label: '逗逗我2~~', msg: DDW, obj: 'Amusing', num: 10, good: ['_10012002*1'] },
    { label: '逗逗我3~~', msg: DDW, obj: 'Amusing', num: 15, good: ['_10013004*1'] },
    { label: '逗逗我4~~', msg: DDW, obj: 'Amusing', num: 20, reroll: 1 },
    { label: '逗逗我5~~', msg: DDW, obj: 'Amusing', num: 25, reroll: 2 },
  ],
  growth: [
    { label: '好好学习~~', msg: '去上一节课吧~', obj: 'Study', num: 1, good: ['_102010001*1'] },
    { label: '勤学苦读~~', msg: '今天上3节课，学霸就是你~', obj: 'Study', num: 3, reroll: 1 },
    { label: '勤劳致富~~', msg: '去打一次工吧~', obj: 'Work', num: 1, good: ['_yb*50'] },
    { label: '打工达人~~', msg: '今天打工3次，元宝多多~', obj: 'Work', num: 3, reroll: 1 },
  ],
  travel: [
    { label: '每日1游~~', msg: '去旅游一次吧~', obj: 'Travel1', num: 1, good: ['_102010001*1'] },
    { label: '每日5游~~', msg: '见多识广哦~', obj: 'Travel1', num: 5, reroll: 2 },
    {
      label: '去5个不同的城市~~',
      msg: '初行记​​ 烟霞初逢，人间烟火的温度，是你与世界交换的第一张明信片，游览5座不同的城市',
      obj: 'Travel2',
      num: 5,
      keep: true,
      good: ['_100010490*1'],
    },
    {
      label: '去10个不同的城市~~',
      msg: '漫游帖 山河漫笔，江南的桥，塞北的雪，像散落的诗笺，都是岁月等你签收的小确幸，游览10座不同的城市',
      obj: 'Travel2',
      num: 10,
      keep: true,
      good: ['_100010127*1'],
    },
    {
      label: '去15个不同的城市~~',
      msg: '寻踪录​ 故迹寻光，有些故事藏在门环后，有些传说埋在树影里，游览15座不同的城市',
      obj: 'Travel2',
      num: 15,
      keep: true,
      good: ['_100010239*1', '_100010497*1'],
    },
    {
      label: '去20个不同的城市~~',
      msg: '探微志​ 风物志异，从茶碗的釉色看一方水土，从方言的尾音听千年变迁，游览20座不同的城市',
      obj: 'Travel2',
      num: 20,
      keep: true,
      good: ['_100010417*1', '_100010499*1', '_100020155*1'],
    },
    {
      label: '去25个不同的城市~~',
      msg: '越障行 云程越嶂，那些被汗水浸透的脚印，终会连成独属于你的地图，游览25座不同的城市',
      obj: 'Travel2',
      num: 25,
      keep: true,
      good: ['_yb*1024', '_100020195*1', '_100020198*1', '_100020217*1'],
    },
    {
      label: '去30个不同的城市~~',
      msg: '奇旅帖​ 星野奇遇，旅行最妙的，是计划外的相遇，游览30座不同的城市',
      obj: 'Travel2',
      num: 30,
      keep: true,
      good: ['_100010485*1', '_100020221*1', '_100010353*1', '_b0000006*1', '_b0000015*1'],
    },
    {
      label: '去35个不同的城市~~',
      msg: '最好的风景，从来不在终点，而在你与它相遇时，眼里的光，游览35座不同的城市',
      obj: 'Travel2',
      num: 35,
      keep: true,
      good: ['_100010486*1', '_yb*2048', '_100020205*1', '_100020240*1', '_b0000016*1', '_60001*1'],
    },
  ],
}
