// The pure parts of review-layers: what can be tested without a session.
export type FileDiff = { file: string; text: string; hash: string; added: number; removed: number }

export const GENERATED =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|go\.sum|Gemfile\.lock)$|\.min\.(js|css)$|\.(snap|map|svg|png|jpe?g|gif|ico|woff2?|ttf|pdf|lock)$|(^|\/)(dist|build|out|node_modules|\.next|coverage|vendor)\//

export function clip(s: unknown, n: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export const SOURCE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|sql|sh|zsh|bash|vue|svelte|prisma|graphql|proto|tf|ya?ml|toml)$|(^|\/)(package|plugin|tsconfig|composer)\.json$/i
export function budgetDiff(files: FileDiff[], max: number): { text: string; cut: number; trimmed: string[] } {
  const total = files.reduce((n, f) => n + f.text.length, 0)
  if (total <= max) return { text: files.map(f => f.text).join('\n'), cut: 0, trimmed: [] }
  // water-filling over one group: smallest first, each takes what it needs while an equal share of what is
  // left would cover it; the first that would not fit sets the level every larger one is cut to
  const levelFor = (group: FileDiff[], budget: number) => {
    const sizes = group.map(f => f.text.length).sort((a, b) => a - b)
    let remaining = budget
    for (let i = 0; i < sizes.length; i++) {
      const share = remaining / (sizes.length - i)
      if (sizes[i]! <= share) remaining -= sizes[i]!
      else return Math.max(600, Math.floor(share))
    }
    return Infinity
  }
  // source files are served first, with the whole budget; assets, docs and generated text share what is left
  const source = files.filter(f => SOURCE.test(f.file))
  const rest = files.filter(f => !SOURCE.test(f.file))
  const sourceLevel = levelFor(source, max)
  const sourceSpent = source.reduce((n, f) => n + Math.min(f.text.length, sourceLevel), 0)
  const restLevel = levelFor(rest, Math.max(0, max - sourceSpent))
  let cut = 0
  const trimmed = new Set<string>()
  const kept = new Map<FileDiff, string>()
  const place = (f: FileDiff, level: number) => {
    if (f.text.length <= level) kept.set(f, f.text)
    else {
      trimmed.add(f.file)
      cut += f.text.length - level
      kept.set(f, f.text.slice(0, level) + `\n[... review-layers cut ${f.text.length - level} characters of this file's diff]`)
    }
  }
  for (const f of source) place(f, sourceLevel)
  for (const f of rest) place(f, restLevel)
  // still over (many tiny files): drop whole files from the low-priority end, largest first, and say so
  const dropOrder = [...rest.sort((a, b) => b.text.length - a.text.length), ...source.sort((a, b) => b.text.length - a.text.length)]
  let size = [...kept.values()].reduce((n, t) => n + t.length + 1, 0)
  const dropped: string[] = []
  for (const f of dropOrder) {
    if (size <= max * 1.05) break
    const t = kept.get(f)
    if (t === undefined) continue
    size -= t.length + 1
    cut += Math.min(t.length, f.text.length) // what was still kept of it; its trim was counted already
    kept.delete(f)
    dropped.push(f.file)
    trimmed.add(f.file)
  }
  const text = files.filter(f => kept.has(f)).map(f => kept.get(f)!).join('\n') + (dropped.length ? `\n[... review-layers left out ${dropped.length} file(s) for room: ${dropped.join(', ')}]` : '')
  return { text, cut, trimmed: [...trimmed] }
}

// What a diff says, without how git labelled it: the same content before and after a commit, with a
// different `index` line or a `new file mode`, hashes the same, so committing never invalidates a review.
export function diffBody(text: string): string {
  // only the `index` line (blob ids, which a commit rewrites) and the ---/+++ file labels of the header are
  // dropped; the path, mode and rename lines say what changed, and every line inside a hunk is content
  const at = text.search(/^@@ /m)
  const header = at < 0 ? text : text.slice(0, at)
  const body = at < 0 ? '' : text.slice(at)
  // with no hunk (a binary) the blob ids on the index line are the only record of the content: keep them
  const drop = at < 0 ? /^(--- |\+\+\+ )/ : /^(index [0-9a-f]+\.\.[0-9a-f]+|--- |\+\+\+ )/
  return header.split('\n').filter(l => !drop.test(l)).join('\n') + body
}

export function fingerprint(f: { file: string; cls: string; title: string }): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 6).join(' ')
  return `${f.file}|${norm(f.cls || f.title)}`
}

export function hunkFor(files: FileDiff[], file: string, line: number | null): string {
  const f = files.find(x => x.file === file) ?? files.find(x => x.file.endsWith('/' + file) || file.endsWith('/' + x.file))
  if (!f) return ''
  if (f.text.length <= 2200 || line === null) return f.text.slice(0, 2200)
  // the hunk that holds the line, by its @@ header
  const hunks = f.text.split(/\n(?=@@ )/)
  const head = hunks[0] ?? ''
  for (const h of hunks.slice(1)) {
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(h)
    if (!m) continue
    const start = Number(m[1])
    const len = Number(m[2] ?? 1)
    if (line >= start - 3 && line <= start + len + 3) {
      // the hunk, cut to about 25 lines either side of the line named
      const rows = h.split('\n')
      let at = 0
      for (let r = 1, n = start; r < rows.length; r++) {
        const c = rows[r]![0]
        if (c === '-' || c === '\\') continue // a removed line, or git's "No newline" marker: not a line of the new file
        if (n === line) { at = r; break }
        n++
      }
      const cut = rows.slice(Math.max(0, at - 25), at + 25).join('\n')
      return (head.split('\n').slice(0, 4).join('\n') + '\n' + (at > 25 ? rows[0] + '\n' : '') + cut).slice(0, 4000)
    }
  }
  return f.text.slice(0, 2200)
}

// One bug, however many hunters raised it and however they phrased it, is one finding.
// Severity is the strongest any of them gave it; the longest evidence wins the wording;
// every absorbed finding's site and title ride along as an instance.
export type RawFinding = { file: string; line: number | null; severity?: string; class?: string; title?: string; why?: string; fix?: string; instances?: string[]; lens: string }
export type Merged = { fp: string; f: RawFinding; seen: number }
const SEV = new Map<string, number>([['important', 3], ['nit', 2], ['pre-existing', 1]])
const rank = (sev: unknown) => SEV.get(String(sev)) ?? 0
const stronger = (a: unknown, b: unknown) => (rank(a) >= rank(b) ? a : b) as string | undefined
export function mergeRaw(raw: RawFinding[]): Merged[] {
const byFp = new Map<string, { f: any; seen: number }>()
  for (const f of raw) {
    const fp = fingerprint({ file: String(f.file), cls: String(f.class ?? ''), title: String(f.title ?? '') })
    const had = byFp.get(fp)
    if (had) {
      // the same class of bug in the same file, wherever it sits, is one finding with several instances
      had.seen++
      // the strongest severity is decided before either object replaces the other
      const severity = stronger(had.f.severity, f.severity)
      if (!had.f.why && f.why) had.f = { ...f, lens: had.f.lens, instances: [...(had.f.instances ?? []), `${had.f.file}:${had.f.line ?? '?'}`] }
      had.f.severity = severity
      if (f.lens === 'security') had.f.lens = 'security'
      had.f.instances = [...new Set([...(had.f.instances ?? []), `${f.file}:${f.line ?? '?'}`, ...(f.instances ?? [])])]
    } else byFp.set(fp, { f: { ...f, instances: [...(f.instances ?? [])] }, seen: 1 })
  }
  // the same bug phrased three ways is one bug: merge findings on the same file within a few lines
  const merged: { fp: string; f: any; seen: number }[] = []
  for (const [fp, x] of byFp) {
    const line = typeof x.f.line === 'number' ? x.f.line : null
    const words = (f: any) => new Set(String((f.class ?? '') + ' ' + (f.title ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3))
    const mine = words(x.f)
    const overlap = (f: any) => { const theirs = words(f); let n = 0; for (const w of mine) if (theirs.has(w)) n++; return n / Math.max(1, Math.min(mine.size, theirs.size)) }
    const cls = (f: any) => new Set(String(f.class ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3))
    const sameClass = (f: any) => { const a = cls(x.f), b = cls(f); let n = 0; for (const w of a) if (b.has(w)) n++; return a.size > 0 && b.size > 0 && n / Math.min(a.size, b.size) >= 0.5 }
    // the same bug: same file, a few lines apart, and the hunters describe it in some of the same words
    const near = merged.find(m => m.f.file === x.f.file && ((line !== null && typeof m.f.line === 'number' && Math.abs(m.f.line - line) <= 6 && overlap(m.f) >= 0.3) || (line !== null && typeof m.f.line === 'number' && Math.abs(m.f.line - line) <= 40 && overlap(m.f) >= 0.6 && sameClass(m.f))))
    if (near) {
      near.seen += x.seen
      // the absorbed finding is not lost: its site and title ride along as an instance
      const site = `${x.f.file}:${line ?? '?'} (${clip(x.f.title ?? '', 60)})`
      const severity = stronger(near.f.severity, x.f.severity)
      if (String(x.f.why ?? '').length > String(near.f.why ?? '').length) near.f = { ...x.f, lens: near.f.lens === 'security' ? 'security' : x.f.lens, instances: [...(near.f.instances ?? []), `${near.f.file}:${near.f.line ?? '?'} (${clip(near.f.title ?? '', 60)})`, site, ...(x.f.instances ?? [])] }
      else near.f.instances = [...(near.f.instances ?? []), site, ...(x.f.instances ?? [])]
      near.f.severity = severity
      if (x.f.lens === 'security') near.f.lens = 'security'
    } else merged.push({ fp, f: x.f, seen: x.seen })
  }
  return merged
}

// Splits a diff too big for one read into up to maxParts parts, each within max, so every file is read.
// Files are spread largest first onto the lightest part. Only what still does not fit is trimmed (by
// budgetDiff, per part), and cut says how much: a run with cut > 0 has not read the whole change.
export function batchDiff(files: FileDiff[], max: number, maxParts: number): { parts: string[]; cut: number; trimmed: string[] } {
  const total = files.reduce((n, f) => n + f.text.length + 1, 0)
  if (total <= max) return { parts: files.length ? [files.map(f => f.text).join('\n')] : [], cut: 0, trimmed: [] }
  // a file bigger than one part is split at its hunks, each piece carrying the file's header
  const pieces = files.flatMap(f => splitFile(f, max))
  // first fit, largest first: a piece goes in the first part with room, or a new part while there may be
  // more; only when every part is full does a piece go to the lightest part, where budgetDiff trims it
  const bins: { size: number; files: FileDiff[] }[] = []
  for (const f of [...pieces].sort((a, b) => b.text.length - a.text.length)) {
    const need = f.text.length + 1
    let bin = bins.find(b => b.size + need <= max)
    if (!bin && bins.length < maxParts) bins.push((bin = { size: 0, files: [] }))
    bin ??= bins.reduce((m, b) => (b.size < m.size ? b : m), bins[0]!)
    bin.files.push(f)
    bin.size += need
  }
  let cut = 0
  const trimmed: string[] = []
  const parts: string[] = []
  for (const bin of bins) {
    if (!bin.files.length) continue
    // keep the files in the order git gave them, so a part reads like a diff
    const ordered = pieces.filter(f => bin.files.includes(f))
    const b = budgetDiff(ordered, max)
    cut += b.cut
    trimmed.push(...b.trimmed)
    parts.push(b.text)
  }
  return { parts, cut, trimmed: [...new Set(trimmed)] }
}

// one file's diff in pieces of at most max characters, cut between hunks; a single hunk bigger than max
// stays whole here (budgetDiff trims it and says so)
export function splitFile(f: FileDiff, max: number): FileDiff[] {
  if (f.text.length <= max) return [f]
  const at = f.text.search(/\n@@ /)
  if (at < 0) return [f]
  const header = f.text.slice(0, at)
  const hunks = f.text.slice(at + 1).split(/\n(?=@@ )/)
  const out: FileDiff[] = []
  let cur = ''
  for (const h of hunks) {
    if (cur && header.length + 1 + cur.length + 1 + h.length > max) {
      out.push({ ...f, text: header + '\n' + cur })
      cur = ''
    }
    cur = cur ? cur + '\n' + h : h
  }
  if (cur) out.push({ ...f, text: header + '\n' + cur })
  return out
}

// Whether a command came from a person: only the sources the engine stamps as a person's own (their Enter at
// the prompt, their phone through Remote Control, their app or `claude -p`, a follow-up to their own click)
// and this mod's own button. Any other stamp is not a person, an unknown or empty kind included. A command
// with no origin at all comes from an engine that stamps none (versions before origins, the test kit); there
// it is taken as the person's, as every command was before, and the Bash hook still blocks the model's route.
const PERSON = new Set(['composer', 'bridge', 'sdk', 'auto-continuation'])
export function isPersonOrigin(origin: unknown, self: string): boolean {
  if (origin === undefined || origin === null) return true
  const o = origin as { kind?: unknown; name?: unknown }
  if (o.kind === 'plugin') return o.name === self
  return typeof o.kind === 'string' && PERSON.has(o.kind)
}
