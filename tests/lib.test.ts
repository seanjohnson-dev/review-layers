import { expect, test } from 'claude-code/testing'
import { batchDiff, budgetDiff, diffBody, hunkFor, isPersonOrigin, mergeRaw, splitFile } from '../hooks/lib'
import type { FileDiff, RawFinding } from '../hooks/lib'

const fd = (file: string, n: number): FileDiff => ({ file, text: `diff --git a/${file} b/${file}\n` + 'x'.repeat(Math.max(0, n - 30)), hash: file, added: 1, removed: 0 })

test('budgetDiff serves source files first and trims assets before code', async () => {
  const files = [fd('docs/big.html', 30000), fd('src/core.ts', 9000), fd('src/tiny.ts', 400), fd('motion/notes.txt', 12000)]
  const { text, cut } = budgetDiff(files, 20000)
  expect(cut).toBeGreaterThan(0)
  expect(text).toContain('x'.repeat(8900)) // core.ts stays whole
  expect(text).toContain('diff --git a/src/tiny.ts')
  expect(text.length).toBeLessThan(21500)
  expect(text).toContain("cut") // an asset says it was trimmed
})

test('budgetDiff trims when every file fits alone but not together', async () => {
  const files = [fd('a.ts', 7000), fd('b.ts', 7000)]
  const { text, cut } = budgetDiff(files, 10000)
  expect(cut).toBeGreaterThan(3000)
  expect(text).toContain('diff --git a/a.ts')
  expect(text).toContain('diff --git a/b.ts')
  expect(text.length).toBeLessThan(10600)
})

test('mergeRaw keeps the strongest severity and the absorbed finding as an instance', async () => {
  const raw: RawFinding[] = [
    { file: 'src/cart.js', line: 15, severity: 'nit', class: 'unit mismatch rands cents', title: 'rands subtracted from cents', why: 'a much longer explanation of the very same bug, written by another hunter', lens: 'edges' },
    { file: 'src/cart.js', line: 16, severity: 'important', class: 'rand cents unit mismatch', title: 'discount uses rands as cents', why: 'short', lens: 'correctness' },
    { file: 'src/cart.js', line: 300, severity: 'important', class: 'unit mismatch rands cents', title: 'rands subtracted from cents', why: 'far away: a different site', lens: 'security' },
  ]
  // one class of bug in one file is one finding, its other sites listed as instances
  const merged = mergeRaw(raw)
  expect(merged).toHaveLength(1)
  expect(merged[0]!.seen).toBe(3)
  expect(merged[0]!.f.severity).toBe('important')
  expect(merged[0]!.f.instances?.join(' ')).toContain('src/cart.js:16')
  expect(merged[0]!.f.instances?.join(' ')).toContain('src/cart.js:300')
})

test('mergeRaw does not merge different bugs that only share a few words', async () => {
  const raw: RawFinding[] = [
    { file: 'a.ts', line: 10, severity: 'important', class: 'unchecked null from API', title: 'user may be null', why: 'w', lens: 'edges' },
    { file: 'a.ts', line: 12, severity: 'important', class: 'missing lower bound', title: 'total can go negative', why: 'w', lens: 'correctness' },
  ]
  expect(mergeRaw(raw)).toHaveLength(2)
})

test('hunkFor finds the hunk by the new-file line, counting removed rows out', async () => {
  const text = ['diff --git a/f.js b/f.js', 'index 1..2 100644', '--- a/f.js', '+++ b/f.js', '@@ -1,3 +1,4 @@', ' a', '-gone', '\\ No newline at end of file', '+b', '+c', ' d'].join('\n') + '\n' + 'x'.repeat(3000)
  const h = hunkFor([{ file: 'f.js', text, hash: 'h', added: 2, removed: 1 }], 'f.js', 3)
  expect(h).toContain('+c')
  expect(h).toContain('@@ -1,3 +1,4 @@')
})

test('mergeRaw never lets a later, wordier nit downgrade an earlier important finding', async () => {
  const raw: RawFinding[] = [
    { file: 'b.ts', line: 5, severity: 'important', class: 'unclamped total', title: 'total goes negative', lens: 'correctness' },
    { file: 'b.ts', line: 5, severity: 'nit', class: 'unclamped total', title: 'total goes negative', why: 'a long why that would otherwise win', lens: 'edges' },
    { file: 'b.ts', line: 9, severity: 'nit', class: 'total not clamped', title: 'negative total possible', why: 'another long why, near the first', lens: 'security' },
  ]
  const merged = mergeRaw(raw)
  expect(merged).toHaveLength(1)
  expect(merged[0]!.f.severity).toBe('important')
  expect(merged[0]!.f.why).toContain('long why')
})

test('the near-site merge keeps the stronger severity whichever wording survives', async () => {
  const raw: RawFinding[] = [
    { file: 'c.ts', line: 5, severity: 'important', class: 'negative charge amount', title: 'charge can go negative', why: 'short', lens: 'correctness' },
    { file: 'c.ts', line: 7, severity: 'nit', class: 'charge amount negative', title: 'amount below zero reaches the gateway', why: 'a much longer explanation that wins the wording', lens: 'edges' },
    { file: 'd.ts', line: 1, class: 'no severity given', title: 'something', why: 'w', lens: 'edges' },
    { file: 'd.ts', line: 1, severity: 'nit', class: 'no severity given', title: 'something', why: 'w', lens: 'security' },
  ]
  const merged = mergeRaw(raw)
  const c = merged.find(m => m.f.file === 'c.ts')!
  expect(c.seen).toBe(2)
  expect(c.f.severity).toBe('important')
  expect(c.f.why).toContain('longer explanation')
  expect(c.f.instances?.join(' ')).toContain('c.ts:5') // the replaced representative's own site is kept
  expect(c.f.instances?.join(' ')).toContain('c.ts:7')
  const d = merged.find(m => m.f.file === 'd.ts')!
  expect(d.f.severity).toBe('nit')
  // a made-up severity never outranks a real one, however it is spelled
  const odd = mergeRaw([{ file: 'e.ts', line: 1, severity: 'nit', class: 'k', title: 't', lens: 'edges' }, { file: 'e.ts', line: 1, severity: 'constructor', class: 'k', title: 't', why: 'w', lens: 'edges' }])
  expect(odd[0]!.f.severity).toBe('nit')
})

test('diffBody ignores how git labelled the change, so a commit does not change the hash', async () => {
  const untracked = 'diff --git a/n.ts b/n.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/n.ts\n@@ -0,0 +1,2 @@\n+a\n+b\n'
  const committed = 'diff --git a/n.ts b/n.ts\nnew file mode 100644\nindex 0000000..2222222\n--- /dev/null\n+++ b/n.ts\n@@ -0,0 +1,2 @@\n+a\n+b\n'
  const changed = committed.replace('+b', '+c')
  expect(diffBody(untracked)).toBe(diffBody(committed))
  expect(diffBody(changed)).not.toBe(diffBody(committed))
  // a content line that starts with --- or +++ is content, not header
  const sql = 'diff --git a/q.sql b/q.sql\nindex 1..2 100644\n--- a/q.sql\n+++ b/q.sql\n@@ -1,2 +1,2 @@\n--- old comment\n+++ new comment\n select 1;\n'
  expect(diffBody(sql)).toContain('--- old comment')
  expect(diffBody(sql.replace('+++ new comment', '+++ other comment'))).not.toBe(diffBody(sql))
  expect(diffBody(sql)).not.toContain('index 1..2')
  // a change with no hunk keeps its header, which is the only thing that tells two of them apart
  const bin = 'diff --git a/logo.png b/logo.png\nindex aaaa..bbbb 100644\nBinary files a/logo.png and b/logo.png differ\n'
  expect(diffBody(bin)).not.toBe('')
  expect(diffBody(bin)).not.toBe(diffBody(bin.replace('bbbb', 'cccc')))
  // a rename or a mode flip with the same hunk is a different change
  expect(diffBody(committed.replace(/n\.ts/g, 'm.ts'))).not.toBe(diffBody(committed))
  expect(diffBody(committed.replace('new file mode 100644', 'new file mode 100755'))).not.toBe(diffBody(committed))
})

const hunky = (file: string, hunks: number, rows: number): FileDiff => ({
  file,
  hash: file,
  added: hunks * rows,
  removed: 0,
  text:
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n` +
    Array.from({ length: hunks }, (_, h) => `@@ -${h * 100 + 1},0 +${h * 100 + 1},${rows} @@\n` + Array.from({ length: rows }, (_, i) => `+const h${h}r${i} = ${i} // padding so each row has some width`).join('\n')).join('\n'),
})

test('splitFile cuts a big file between hunks and repeats the header', async () => {
  const f = hunky('src/big.ts', 6, 20)
  const pieces = splitFile(f, 3000)
  expect(pieces.length).toBeGreaterThan(1)
  for (const p of pieces) {
    expect(p.text.startsWith('diff --git a/src/big.ts b/src/big.ts\n--- a/src/big.ts\n+++ b/src/big.ts\n@@ ')).toBe(true)
    expect(p.text.length).toBeLessThanOrEqual(3000)
  }
  // every hunk is in exactly one piece
  for (let h = 0; h < 6; h++) expect(pieces.filter(p => p.text.includes(`const h${h}r19 `))).toHaveLength(1)
})

test('batchDiff reads one file bigger than the budget whole, across parts', async () => {
  const { parts, cut, trimmed } = batchDiff([hunky('src/big.ts', 6, 20)], 3000, 3)
  expect(cut).toBe(0)
  expect(trimmed).toHaveLength(0)
  expect(parts.length).toBeGreaterThan(1)
  for (let h = 0; h < 6; h++) expect(parts.some(p => p.includes(`const h${h}r19 `))).toBe(true)
})

test('batchDiff names what it could not fit in its parts', async () => {
  const { cut, trimmed } = batchDiff([hunky('src/a.ts', 6, 20), hunky('src/b.ts', 6, 20)], 3000, 2)
  expect(cut).toBeGreaterThan(0)
  expect(trimmed.length).toBeGreaterThan(0)
})

test('batchDiff leaves a diff that fits as one part', async () => {
  const { parts, cut } = batchDiff([hunky('src/a.ts', 1, 5)], 40000, 3)
  expect(parts).toHaveLength(1)
  expect(cut).toBe(0)
})

test('a sign-off counts only from a person', async () => {
  for (const kind of ['composer', 'bridge', 'sdk']) expect(isPersonOrigin({ kind }, 'review-layers')).toBe(true)
  for (const kind of ['peer', 'peer-send-message', 'coordinator', 'scheduled-trigger', 'task-notification', 'channel', 'observer']) expect(isPersonOrigin({ kind }, 'review-layers')).toBe(false)
  expect(isPersonOrigin({ kind: 'plugin', name: 'review-layers' }, 'review-layers')).toBe(true)
  expect(isPersonOrigin({ kind: 'plugin', name: 'some-other-mod' }, 'review-layers')).toBe(false)
  for (const o of [{}, { kind: '' }, { kind: 'unclassified' }, { kind: 'something-new' }, 'composer']) expect(isPersonOrigin(o, 'review-layers')).toBe(false)
  // an engine that stamps no origin at all: the command is the person's, as before origins existed
  expect(isPersonOrigin(undefined, 'review-layers')).toBe(true)
})
