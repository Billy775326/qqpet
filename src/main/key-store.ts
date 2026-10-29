import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'

export interface KeyEncryption {
  available(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}

/** Only encrypted bytes are persisted; unavailable keyrings never fall back to plaintext. */
export function createKeyStore(file: string, encryption: KeyEncryption) {
  let issue = ''
  return {
    status(): string {
      return issue || (encryption.available() ? '已启用系统加密保存；同一系统用户重启后可继续使用。换电脑或系统用户需重新输入。' : '系统安全存储不可用，API Key 仅本次运行有效。')
    },
    load(url: string): string {
      issue = ''
      if (!existsSync(file)) return ''
      if (!encryption.available()) { issue = '系统安全存储不可用，已保留加密文件，请重新输入 API Key。'; return '' }
      try {
        const data = JSON.parse(encryption.decrypt(readFileSync(file)))
        if (data.version !== 1 || typeof data.key !== 'string' || typeof data.url !== 'string') throw new Error('Invalid credential format')
        if (data.url !== url) { issue = '接口地址已变化，请为当前接口重新输入 API Key。'; return '' }
        return data.key
      } catch {
        issue = '已保存的 API Key 无法在当前系统用户下解密（或文件损坏），请重新输入；原加密文件已保留。'
        return ''
      }
    },
    save(key: string, url: string): void {
      if (key === '') {
        if (existsSync(file)) unlinkSync(file)
        issue = ''
        return
      }
      if (!encryption.available()) { issue = '系统安全存储不可用，API Key 仅本次运行有效；原加密文件已保留。'; return }
      const tmp = `${file}.tmp`
      try {
        const encrypted = encryption.encrypt(JSON.stringify({ version: 1, url, key }))
        writeFileSync(tmp, encrypted, { mode: 0o600 })
        renameSync(tmp, file)
        issue = ''
      } catch {
        issue = '无法加密保存 API Key，本次运行仍可使用；请检查目录权限或系统安全存储。原加密文件已保留。'
      } finally {
        try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* encrypted temporary bytes only */ }
      }
    },
  }
}
