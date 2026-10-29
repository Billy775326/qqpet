import type { SaveData, SavePatch, Sex } from './save'

const now = (): number => Math.floor(Date.now() / 1000)
const rand = (min: number, max: number) => (): number => Math.round(Math.random() * (max - min) + min)

type Rule = (v: unknown) => unknown
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const num =
  (min: number, max: number, fallback: number | (() => number)): Rule =>
  (v) =>
    isNum(v) && v >= min && v <= max ? v : typeof fallback === 'function' ? fallback() : fallback
const bool: Rule = (v) => (typeof v === 'boolean' ? v : false)
const list: Rule = (v) => (Array.isArray(v) ? v : [])
const str =
  (fallback: string): Rule =>
  (v) =>
    typeof v === 'string' ? v : fallback
const nullable: Rule = (v) => (v === undefined ? null : v)
const ANY = Infinity
const AI_URL = 'http://127.0.0.1:8000/v1'

// Field repairs ported from the original main process: an invalid value is
// replaced by the same fallback the original used.
const RULES: Record<string, Record<string, Rule>> = {
  petInfo: {
    name: (v) => v || '瀹犲疂~',
    host: (v) => v || '涓讳汉~',
    sex: (v) => (v === 'GG' || v === 'MM' ? v : 'GG'),
    growth: num(-ANY, ANY, 0),
    hunger: num(0, ANY, 0),
    clean: num(0, ANY, 0),
    health: num(0, 5, 0),
    mood: num(0, 1000, 0),
    birthDay: num(1, ANY, now),
    intel: num(-ANY, ANY, rand(5, 50)),
    charm: num(-ANY, ANY, rand(5, 50)),
    strong: num(-ANY, ANY, rand(5, 50)),
    // The original defaulted this to the string "0".
    onLineTime: (v) => (isNum(v) ? v : Number(v) || 0),
    lastX: num(0, ANY, -1),
    lastY: num(0, ANY, -1),
    yb: (v) => (isNum(v) ? v | 0 : 5000),
    lastLoginTime: num(0, ANY, 0),
    onlineDataTime: num(0, ANY, 0),
    pinkDiamond: bool,
    PDgrowth: num(0, ANY, 0),
    PDgrowthValue: num(0, ANY, 0),
    PDgrowthValue_next: num(0, ANY, 0),
    PDiamondLevel: num(0, ANY, 0),
    PDiamondBeginDate: num(0, ANY, 0),
    PDiamondExpirationDate: num(0, ANY, 0),
    sweetHeart: bool,
    sweetHeartOverTime: num(0, ANY, 0),
  },
  petComputedlInfo: {
    level: num(1, ANY, 1),
    upGrowth: num(0, ANY, 0),
    nextGrowth: num(125, ANY, 125),
    hungerMax: num(1000, ANY, 1000),
    cleanMax: num(1000, ANY, 1000),
    healthMax: num(5, 5, 5),
    moodMax: num(1000, 1000, 1000),
  },
  studyInfo: Object.fromEntries(
    ['chinese', 'mathematics', 'politics', 'music', 'art', 'manner', 'pe', 'labouring', 'wushu'].map((k) => [k, num(0, ANY, 0)]),
  ),
  activeOption: { work: nullable, study: nullable, trip: nullable, ill: nullable, die: nullable },
  selfGoodDatas: {
    ...Object.fromEntries(['food', 'clean', 'medicine', 'background', 'nums', 'service', 'work', 'study', 'trip'].map((k) => [k, list])),
    // Toys whose id contains "__" were removed from the game; drop them in place.
    toy: (v) => {
      if (!Array.isArray(v)) return []
      for (let i = v.length - 1; i >= 0; i--) if (String(v[i]).includes('__')) v.splice(i, 1)
      return v
    },
  },
  selfGoodUseOption: { background: nullable, food: nullable, clean: nullable, toy: nullable },
  gameSaveDatas: {
    fishing_harvestfish: num(0, ANY, 0),
    travel_china: list,
    travel_china_num: num(0, ANY, 0),
    ddw: num(0, ANY, 0),
    yyds: num(0, ANY, 0),
  },
  settings: {
    opacity: num(0, 1, 1),
    faceClick: (v) => (v === 0 || v === 1 || v === 2 ? v : 2),
    quiet: bool,
    autoStart: bool,
    paused: bool,
    hidden: bool,
    hd: bool,
    clip: bool,
    aiUrl: str(AI_URL),
    aiKey: str(''),
    aiModel: str(''),
    weatherCity: str(''),
  },
}

function fresh(): SaveData {
  return {
    havePet: false,
    isBury: false,
    saveNum: 0,
    nowTimeLine: 0,
    petInfo: {
      name: '瀹犲疂~',
      host: '涓讳汉~',
      sex: 'GG',
      growth: 0,
      hunger: 1100,
      clean: 1100,
      health: 5,
      mood: 1000,
      birthDay: now(),
      intel: rand(5, 50)(),
      charm: rand(5, 50)(),
      strong: rand(5, 50)(),
      onLineTime: 0,
      lastX: -1,
      lastY: -1,
      yb: 5000,
      lastLoginTime: 0,
      onlineDataTime: 0,
      pinkDiamond: false,
      PDgrowth: 0,
      PDgrowthValue: 0,
      PDgrowthValue_next: 0,
      PDiamondLevel: 0,
      PDiamondBeginDate: 0,
      PDiamondExpirationDate: 0,
      sweetHeart: false,
      sweetHeartOverTime: 0,
    },
    petComputedlInfo: { level: 1, upGrowth: 0, nextGrowth: 125, hungerMax: 1100, cleanMax: 1100, healthMax: 5, moodMax: 1000 },
    studyInfo: { chinese: 0, mathematics: 0, politics: 0, music: 0, art: 0, manner: 0, pe: 0, labouring: 0, wushu: 0 },
    activeOption: { work: null, study: null, trip: null, ill: null, die: null },
    selfGoodDatas: {
      food: ['_10013006*2', '_102010001*3'],
      clean: ['_10021008*2', '_10021005*2'],
      medicine: ['_60001*2', '_50001*1'],
      background: ['_b0000000*1', '_b0000001*1'],
      service: [],
      work: [],
      study: [],
      trip: [],
      toy: ['_t0002*1'],
      nums: [],
    },
    selfGoodUseOption: { background: null, food: null, clean: null, toy: null },
    gameSaveDatas: { fishing_harvestfish: 0, travel_china: [], travel_china_num: 0, ddw: 0, yyds: 0 },
    illustrated: [],
    saveJsonData: { email: '{}', task: '{}', signin: '{}', fishs: '{}' },
    settings: {
      opacity: 1,
      faceClick: 2,
      quiet: false,
      autoStart: false,
      paused: false,
      hidden: false,
      hd: false,
      clip: false,
      aiUrl: AI_URL,
      aiKey: '',
      aiModel: '',
      weatherCity: '',
    },
  }
}

function repair(data: Record<string, any>): string[] {
  const fixed: string[] = []
  for (const [group, rules] of Object.entries(RULES)) {
    if (!record(data[group])) data[group] = {}
    for (const [field, rule] of Object.entries(rules)) {
      const v = rule(data[group][field])
      if (v === data[group][field]) continue
      data[group][field] = v
      fixed.push(`${group}.${field}`)
    }
  }
  if (!Array.isArray(data.illustrated)) data.illustrated = []
  if (!record(data.saveJsonData)) data.saveJsonData = {}
  for (const [key, value] of Object.entries(data.saveJsonData)) {
    try {
      if (key === 'activity' || key === 'weather') continue
      const parsed = JSON.parse(String(value))
      if (key === 'album' ? !Array.isArray(parsed) : !record(parsed)) throw new Error('invalid data')
      if (key === 'task' && (parsed.taskList && !record(parsed.taskList) || parsed.daily && !Array.isArray(parsed.daily))) throw new Error('invalid tasks')
      if (key === 'task' && parsed.taskList && Object.values(parsed.taskList).some(v => !Array.isArray(v) || v.some(e => !record(e) || !Array.isArray(e.good)))) throw new Error('invalid rewards')
      if (key === 'signin' && parsed.collectionList && (!record(parsed.collectionList) || Object.values(parsed.collectionList).some(y => !record(y) || Object.values(y).some(m => !Array.isArray(m))))) throw new Error('invalid signin')
      if (key === 'email' && Object.values(parsed).some(m => !record(m) || !m.e && !Array.isArray(m.glb))) throw new Error('invalid email')
      if (key === 'farm' && !Array.isArray(parsed.farmland)) throw new Error('invalid farm')
      if (key === 'fishs' && parsed.fishs && !Array.isArray(parsed.fishs)) throw new Error('invalid pond')
    } catch { delete data.saveJsonData[key] }
  }
  for (const type of Object.keys(data.selfGoodDatas)) {
    if (Array.isArray(data.selfGoodDatas[type])) data.selfGoodDatas[type] = data.selfGoodDatas[type].filter((v: unknown) => typeof v === 'string' && /^_.+\*\d+$/.test(v))
  }
  const defaults = fresh() as unknown as Record<string, any>
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value !== 'object' && (typeof data[key] !== typeof value || typeof data[key] === 'number' && !Number.isFinite(data[key]))) data[key] = value
  }
  return fixed
}

/** The save in a file of ours, or in the original's config.json (under `petInfoData`). */
export function petOf(data: Record<string, any>): Record<string, any> {
  if (!record(data)) throw new Error('存档必须是 JSON 对象')
  const pet = data.petInfoData ?? data
  if (!record(pet)) throw new Error('存档格式无效')
  delete pet.machineId
  delete pet.oId
  return pet
}

/** The save to run with: the stored pet, repaired, or else a new one. */
export function startSave(stored: Record<string, any> | null): SaveData {
  if (stored) stored = clean(stored) as Record<string, any>
  if (stored?.havePet === true) {
    const fixed = repair(stored)
    if (fixed.length) console.warn('repaired save fields:', fixed.join(', '))
    return stored as SaveData
  }
  // A new pet keeps the owner's preferences, but not the old pet's pause or hiding.
  const save = fresh()
  if (record(stored?.settings)) Object.assign(save.settings, stored.settings, { paused: false, hidden: false })
  return save
}

export function applyPatch(save: SaveData, patch: SavePatch): void {
  if (!record(patch)) throw new Error('Invalid save patch')
  const safe = clean(patch) as Record<string, any>
  const defaults = fresh() as unknown as Record<string, any>
  for (const [key, value] of Object.entries(safe)) {
    if (!Object.hasOwn(defaults, key)) throw new Error('Unknown save field')
    if (record(defaults[key])) {
      if (!record(value)) throw new Error('Invalid save group')
      for (const field of Object.keys(value)) {
        if (key !== 'saveJsonData' && !Object.hasOwn(defaults[key], field)) throw new Error('Unknown save field')
      }
    } else if (Array.isArray(defaults[key]) ? !Array.isArray(value) : typeof value !== typeof defaults[key]) throw new Error('Invalid save value')
  }
  const candidate = structuredClone(save) as unknown as Record<string, any>
  for (const [key, value] of Object.entries(safe)) {
    if (record(value)) Object.assign(candidate[key], value)
    else candidate[key] = value
  }
  repair(candidate)
  Object.assign(save, candidate)
  save.saveNum++
}

/** Import is validated before the current file or its backup is touched. */
export function validatedImport(value: unknown): SaveData {
  const pet = petOf(value as Record<string, any>)
  if (pet.havePet !== true) throw new Error('存档没有宠物')
  for (const group of Object.keys(RULES)) if (pet[group] !== undefined && !record(pet[group])) throw new Error('存档分组格式无效')
  return startSave(pet)
}

/** Credentials never enter ordinary saves, backups or exports. */
export function publicSave(save: SaveData): SaveData {
  return { ...save, settings: { ...save.settings, aiKey: '' } }
}

/** Buries the pet: the next start selects an egg, or begins with a newborn of `sex`. */
export function buried(save: SaveData, sex?: Sex): SaveData {
  save.havePet = false
  save.isBury = false
  if (!sex) return save
  const born = startSave(save)
  born.petInfo.sex = sex
  born.havePet = true
  return born
}

function record(v: unknown): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function clean(v: unknown, depth = 0): unknown {
  if (depth > 40) throw new Error('Save nesting too deep')
  if (Array.isArray(v)) return v.map(x => clean(x, depth + 1))
  if (!record(v)) return v
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('Unsafe save field')
    out[k] = clean(x, depth + 1)
  }
  return out
}
