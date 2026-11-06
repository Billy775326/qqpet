import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function releaseNotes(changelog, version) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw Error('Invalid release version')
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex(line => line.startsWith(`## [${version}] - `))
  if (start < 0) throw Error(`Missing CHANGELOG section for ${version}`)
  const next = lines.findIndex((line, index) => index > start && (line.startsWith('## ') || /^\[[^\]]+\]:\s/.test(line)))
  const section = lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim()
  if (!/^\s*- /m.test(section)) throw Error(`Empty CHANGELOG section for ${version}`)
  return section + '\n'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = (process.env.RELEASE_TAG ?? process.argv[2] ?? '').replace(/^v/, '')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  if (version !== pkg.version) throw Error('Release tag and package version differ')
  process.stdout.write(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version))
}
