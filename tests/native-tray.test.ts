import assert from 'node:assert/strict'
import test from 'node:test'
import { startSave } from '../src/shared/save-logic.ts'
import { trayMenuEntries } from '../src/shared/tray-menu.ts'
import { menuPriority } from '../src/main/menu-priority.ts'

test('native tray actions follow current adoption, health, hidden and paused state', () => {
  const save = startSave(null)
  assert.equal(trayMenuEntries(save)[0].action, '选择宠物')
  save.havePet = true
  save.petInfo.health = 5
  save.settings.hidden = true
  assert.ok(trayMenuEntries(save).some(entry => entry.action === '显示宠物'))
  assert.deepEqual(trayMenuEntries(save).find(entry => entry.label === '喂养宠物')?.submenu?.map(entry => entry.action), ['喂养', '清洗', '吃药'])
  save.settings.hidden = false
  save.settings.paused = true
  save.settings.aiModel = 'local-model'
  const entries = trayMenuEntries(save)
  assert.ok(entries.some(entry => entry.action === '隐藏宠物'))
  assert.ok(entries.some(entry => entry.action === '和我聊天'))
  assert.equal(entries.find(entry => entry.action === '开始成长')?.checked, true)
  save.petInfo.health = 0
  assert.ok(trayMenuEntries(save).some(entry => entry.action === '埋葬宠物'))
  save.isBury = true
  assert.equal(trayMenuEntries(save)[0].action, '您的宠物')
})

test('HTML menu priority is temporary and repeated opens retain the original window state', () => {
  let focusable = false, onTop = false, raised = 0
  const priority = menuPriority({
    isFocusable: () => focusable, isAlwaysOnTop: () => onTop,
    setFocusable: value => { focusable = value },
    setAlwaysOnTop: value => { onTop = value },
    show() {}, moveTop() { raised++ }, focus() {},
  })
  priority.setOpen(true)
  priority.setOpen(true)
  assert.ok(focusable && onTop && priority.open)
  assert.equal(raised, 1)
  priority.setOpen(false)
  assert.equal(focusable, false)
  assert.equal(onTop, false)
  priority.setOpen(false)
  focusable = onTop = true
  priority.setOpen(true)
  priority.setOpen(false)
  assert.ok(focusable && onTop, 'preexisting user window state must survive a menu cycle')
})
