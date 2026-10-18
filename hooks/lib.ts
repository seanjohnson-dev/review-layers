// The pure parts of review-layers: what can be tested without a session.
export type FileDiff = { file: string; text: string; hash: string; added: number; removed: number }

export const GENERATED =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|go\.sum|Gemfile\.lock)$|\.min\.(js|css)$|\.(snap|map|svg|png|jpe?g|gif|ico|woff2?|ttf|pdf|lock)$|(^|\/)(dist|build|out|node_modules|\.next|coverage|vendor)\//

export function clip(s: unknown, n: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export const SOURCE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|sql|sh|zsh|bash|vue|svelte|prisma|graphql|proto|tf|ya?ml|toml)$|(^|\/)(package|plugin|tsconfig|composer)\.json$/i
export function budgetDiff(files: FileDiff[], max: number): { text: string; cut: number } {
  const total = files.reduce((n, f) => n + f.text.length, 0)
  if (total <= max) return { text: files.map(f => f.text).join('\n'), cut: 0 }
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
  const kept = new Map<FileDiff, string>()
  const place = (f: FileDiff, level: number) => {
    if (f.text.length <= level) kept.set(f, f.text)
    else {
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
  }
  const text = files.filter(f => kept.has(f)).map(f => kept.get(f)!).join('\n') + (dropped.length ? `\n[... review-layers left out ${dropped.length} file(s) for room: ${dropped.join(', ')}]` : '')
  return { text, cut }
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
        if (c === '-') continue // not a line of the new file
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
const SEV = { important: 3, nit: 2, 'pre-existing': 1 } as Record<string, number>
const rank = (sev: unknown) => SEV[String(sev)] ?? 0
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
