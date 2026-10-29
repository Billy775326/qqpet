import { portable } from './paths'
import { app, safeStorage } from 'electron'
import { createKeyStore } from './key-store'
import { copyFileSync, statSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SaveData, SavePatch, Sex } from '../shared/save'
import { applyPatch, buried, petOf, startSave, publicSave, validatedImport } from '../shared/save-logic'

const keys = createKeyStore(join(app.getPath('userData'), 'credentials.bin'), {
  available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || !['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend())),
  encrypt: value => safeStorage.encryptString(value),
  decrypt: value => safeStorage.decryptString(value),
})
export const keyStorageStatus = (): string => keys.status()

const FILE = join(app.getPath('userData'), 'save.json')
// Arctic Penguin T800 kept the same data under `petInfoData` in electron-store.
const LEGACY_FILE = join(app.getPath('appData'), 'Arctic Penguin', 'config.json')

const readJson = (file: string): Record<string, any> => {
  if (statSync(file).size > 10 * 1024 * 1024) throw new Error('存档超过 10 MiB 限制')
  return JSON.parse(readFileSync(file, 'utf8'))
}

function read(): Record<string, any> | null {
  if (existsSync(FILE)) {
    try {
      return startSave(readJson(FILE))
    } catch (e) {
      // Keep the broken file for manual recovery instead of silently losing the pet.
      const backup = `${FILE}.corrupt-${Date.now()}`
      renameSync(FILE, backup)
      console.error(`save file is corrupt, moved to ${backup}:`, e)
      return null
    }
  }
  if (!portable && existsSync(LEGACY_FILE)) {
    console.log(`migrating save from ${LEGACY_FILE}`)
    return petOf(readJson(LEGACY_FILE))
  }
  return null
}

function write(data: SaveData): void {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(publicSave(data)))
  renameSync(tmp, FILE)
}

let save: SaveData

export function loadSave(): SaveData {
  save = startSave(read())
  const legacy = save.settings.aiKey
  save.settings.aiKey = keys.load(save.settings.aiUrl)
  if (!save.settings.aiKey && legacy) {
    keys.save(legacy, save.settings.aiUrl)
    save.settings.aiKey = legacy
  }
  write(save)
  return save
}

export function getSave(): SaveData {
  return save
}

export function patchSave(patch: SavePatch): void {
  const next = structuredClone(save)
  applyPatch(next, patch)
  if (patch.settings && Object.hasOwn(patch.settings, 'aiKey')) keys.save(next.settings.aiKey, next.settings.aiUrl)
  else if (next.settings.aiUrl !== save.settings.aiUrl) next.settings.aiKey = keys.load(next.settings.aiUrl)
  write(next)
  save = next
}

export function exportSave(file: string): void {
  writeFileSync(file, JSON.stringify(publicSave(save), null, 2))
}

/**
 * Replaces the save with the pet in `file`, keeping the current one as save.json.bak;
 * the next launch repairs it. Throws when the file holds no pet.
 */
export function importSave(file: string): void {
  const pet = validatedImport(readJson(file))
  copyFileSync(FILE, `${FILE}.bak`)
  write(pet)
}

/** Buries the pet: the next launch starts with egg selection, or with a newborn of `sex`. */
export function resetSave(sex?: Sex): void {
  save = buried(save, sex)
  write(save)
}
