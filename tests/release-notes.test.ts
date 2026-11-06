import assert from 'node:assert/strict'
import test from 'node:test'
import { releaseNotes } from '../scripts/release-notes.mjs'

test('release notes include the exact version and preserve user-facing Markdown', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n- Planned\n\n## [0.2.0] - 2026-11-06\n\nUpgrade instructions.\n\n### Added\n\n- New tasks\n\n### Fixed\n\n- Hover hints\n\n## [0.1.4] - 2026-10-29\n\n- Previous release\n'
  assert.equal(releaseNotes(changelog, '0.2.0'), 'Upgrade instructions.\n\n### Added\n\n- New tasks\n\n### Fixed\n\n- Hover hints\n')
  assert.equal(releaseNotes(changelog.replaceAll('\n', '\r\n'), '0.2.0'), releaseNotes(changelog, '0.2.0'))
})

test('missing, empty or invalid release sections fail instead of publishing empty notes', () => {
  assert.throws(() => releaseNotes('## [Unreleased]\n\n- Pending\n', '0.2.0'), /Missing/)
  assert.throws(() => releaseNotes('## [0.2.0] - 2026-11-06\n\n## [0.1.4] - 2026-10-29\n- Old\n', '0.2.0'), /Empty/)
  assert.throws(() => releaseNotes('', 'Unreleased'), /Invalid/)
})

test('the last release excludes changelog comparison definitions', () => {
  assert.equal(releaseNotes('## [0.2.0] - 2026-11-06\n\n- New tasks\n\n[Unreleased]: https://example.com/compare\n', '0.2.0'), '- New tasks\n')
})
