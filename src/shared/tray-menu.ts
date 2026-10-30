import type { SaveData } from './save'

export interface TrayMenuEntry {
  label: string
  action?: string
  submenu?: TrayMenuEntry[]
  type?: 'checkbox'
  checked?: boolean
}

/** Rebuilt on every opening so hidden, paused and adoption state cannot go stale. */
export function trayMenuEntries(state: SaveData): TrayMenuEntry[] {
  const action = (label: string, key = label): TrayMenuEntry => ({ label, action: key })
  const leave = action('退出宠物')
  if (!state.havePet) return [action('选择宠物'), leave]
  if (state.isBury) return [action('重新领养宠物', '您的宠物'), leave]
  const help = { label: '设置帮助', submenu: [action('宠物资料'), action('系统设置')] }
  if (state.petInfo.health === 0) return [action('打开商城'), help, action('埋葬宠物'), leave]
  return [
    ...(state.settings.aiModel ? [action('和我聊天')] : []),
    action('打开商城'),
    { label: '喂养宠物', submenu: [action('喂养'), action('清洗'), action('吃药')] },
    action(state.settings.hidden ? '显示宠物' : '隐藏宠物'),
    help,
    { ...action(state.settings.paused ? '开始成长' : '停止成长'), type: 'checkbox', checked: state.settings.paused },
    leave,
  ]
}
