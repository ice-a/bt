import test from 'node:test'
import assert from 'node:assert/strict'
import { toFavorite, parseFavorites, serializeFavorites, mergeFavorites, MAX_BACKUP_BYTES } from '../app/utils/favorites.ts'
import { filterTorrents } from '../app/utils/torrentList.ts'

const item = (n, extra = {}) => toFavorite({
  infoHash: n.toString(16).padStart(40, '0'), name: `Linux ${n}`, ...extra
}, '2026-01-01T00:00:00.000Z')
const filters = { text: '', source: '', size: '', seeded: false, sort: 'seeders' }

test('backup round-trip keeps metadata, deduplicates hashes and drops file lists', () => {
  const first = item(1, { files: [{ path: 'installer.iso', length: 12 }], size: 12 })
  const restored = parseFavorites(serializeFavorites([first, { ...first, infoHash: first.infoHash.toUpperCase() }]))
  assert.equal(restored.length, 1)
  assert.equal(restored[0].fileCount, 1)
  assert.equal(restored[0].files, null)
  assert.equal(restored[0].savedAt, first.savedAt)
  assert.equal(restored[0].size, 12)
})

test('normalizes hashes, rebuilds matching magnets and rejects invalid tracker protocols', () => {
  const hash = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01'
  const favorite = toFavorite({
    infoHash: hash, name: 'Ubuntu & tools', size: -1, seeders: '99',
    magnet: 'magnet:?xt=urn:btih:0000000000000000000000000000000000000000&tr=wss%3A%2F%2Ftracker.example%2Fannounce',
    trackers: ['javascript:alert(1)', 'file:///etc/passwd', 'udp://tracker.example:80/announce']
  })
  const magnet = new URL(favorite.magnet)
  assert.equal(magnet.searchParams.get('xt'), `urn:btih:${hash.toLowerCase()}`)
  assert.equal(magnet.searchParams.get('dn'), 'Ubuntu & tools')
  assert.equal(favorite.size, 0)
  assert.equal(favorite.seeders, null)
  assert.deepEqual(favorite.trackers, ['udp://tracker.example:80/announce', 'wss://tracker.example/announce'])
})

test('malformed or oversized backups fail before a merge can overwrite existing data', () => {
  for (const raw of ['oops', 'null', '[]', '{"version":2,"items":[]}', JSON.stringify({ version: 1, items: [item(1), { infoHash: 'bad' }] })]) {
    assert.throws(() => parseFavorites(raw))
  }
  assert.throws(() => parseFavorites(' '.repeat(MAX_BACKUP_BYTES + 1)))
  const existing = Array.from({ length: 1000 }, (_, i) => item(i + 1))
  assert.throws(() => mergeFavorites(existing, [item(1001)]))
  assert.equal(existing.length, 1000)
})

test('imports merge without duplicating or replacing an existing favorite', () => {
  const first = item(1, { name: 'Keep this name' })
  const merged = mergeFavorites([first], [item(1, { name: 'Other name' }), item(2), item(2)])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].name, 'Keep this name')
})

test('filters combine text, source, size and availability without treating unknowns as seeded', () => {
  const items = [item(1, { source: 'nyaa', size: 1024 ** 3, seeders: 4 }), item(2, { source: 'nyaa', size: 10 * 1024 ** 3 }), item(3)]
  assert.deepEqual(filterTorrents(items, { ...filters, text: 'LINUX', source: 'nyaa', size: 'medium', seeded: true }), [items[0]])
  assert.deepEqual(filterTorrents(items, { ...filters, size: 'large' }), [items[1]])
  assert.deepEqual(filterTorrents(items, { ...filters, source: 'unknown' }), [items[2]])
  assert.equal(filterTorrents(items, { ...filters, size: 'small' }).length, 0)
  assert.equal(filterTorrents(items, { ...filters, text: items[1].infoHash }).length, 1)
})

test('sorting keeps unknown values last and leaves the source order unchanged', () => {
  const items = [item(1), item(2, { size: 20, seeders: 5, addedAt: '2026-01-01' }), item(3, { size: 10, seeders: 0, addedAt: '2026-02-01' })]
  const names = (list) => list.map((entry) => entry.name)
  assert.deepEqual(names(filterTorrents(items, { ...filters, sort: 'size-asc' })), ['Linux 3', 'Linux 2', 'Linux 1'])
  assert.deepEqual(names(filterTorrents(items, filters)), ['Linux 2', 'Linux 3', 'Linux 1'])
  assert.deepEqual(names(filterTorrents(items, { ...filters, sort: 'newest' })), ['Linux 3', 'Linux 2', 'Linux 1'])
  assert.deepEqual(names(items), ['Linux 1', 'Linux 2', 'Linux 3'])
})
