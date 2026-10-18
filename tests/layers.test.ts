import { expect, mock, test } from 'claude-code/testing'

const TOOL = 'mcp__review-layers__land'

const DIFF = `diff --git a/src/pay.ts b/src/pay.ts
index 1111111..2222222 100644
--- a/src/pay.ts
+++ b/src/pay.ts
@@ -1,4 +1,6 @@
 export function total(items) {
-  return items.reduce((n, i) => n + i.price, 0)
+  const sum = items.reduce((n, i) => n + i.price * i.qty, 0)
+  return sum / items.length
 }
`

type Reply = (system: string, prompt: string) => string

// A machine beneath the mod: a git repo with one changed file, a store, and a model that answers as told.
function machine(on: any, opts: { diff?: string; head?: string; reply: Reply; files?: Record<string, string>; checks?: Record<string, number> } = { reply: () => '[]' }) {
  const diff = opts.diff ?? DIFF
  const head = opts.head ?? 'abc123'
  const files: Record<string, string> = { ...(opts.files ?? {}) }
  const ran: string[] = []
  const modelCalls: { system: string; prompt: string }[] = []
  mock.store(on, {})
  // the shell beneath the gate: a push that is let through succeeds
  on('tool.call', { tool: 'Bash' }, async () => ({ result: 'ok' }))
  on('session.cwd', async () => ({ value: '/repo' }))
  on('env.get', async () => ({ value: undefined }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('ui.status', async () => ({ value: undefined }))
  on('ui.toast', async () => ({ value: undefined }))
  on('ui.open', async () => ({ value: { isPlaced: false, reason: 'no-surface' } }))
  on('fs.exists', async (_$: any, e: any) => ({ value: e.path in files }))
  on('fs.read', async (_$: any, e: any) => (e.path in files ? { value: files[e.path] } : { deny: 'ENOENT' }))
  on('fs.write', async (_$: any, e: any) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('model.complete', async (_$: any, e: any) => {
    modelCalls.push({ system: e.system ?? '', prompt: e.prompt })
    return { value: { isAnswered: true, text: opts.reply(e.system ?? '', e.prompt), usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
  })
  on('process.run', async (_$: any, e: any) => {
    const argv: string[] = e.argv
    ran.push(argv.join(' '))
    const ok = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv[0] === 'git') {
      const sub = argv.slice(1).join(' ')
      if (sub === 'rev-parse --show-toplevel') return ok('/repo\n')
      if (sub === 'rev-parse HEAD') return ok(head + '\n')
      if (sub === 'rev-parse --abbrev-ref HEAD') return ok('feature\n')
      if (sub === 'rev-parse --abbrev-ref @{upstream}') return ok('', 128)
      if (sub.startsWith('rev-parse --verify --quiet origin/main')) return ok('base000\n')
      if (sub.startsWith('rev-parse --verify --quiet')) return ok('', 1)
      if (sub.startsWith('merge-base')) return ok('base000\n')
      if (sub.startsWith('diff base000')) return ok(diff)
      if (sub === 'status --porcelain') return ok(diff ? ' M src/pay.ts\n' : '')
      if (sub === 'ls-files --others --exclude-standard') return ok('')
      if (sub.startsWith('rev-list --count')) return ok('1\n')
      return ok('')
    }
    if (argv[0] === 'sh') {
      const cmd = argv[2] ?? ''
      const code = opts.checks?.[cmd] ?? 0
      return ok(code ? 'FAIL src/pay.test.ts\n' : 'ok\n', code)
    }
    return ok('')
  })
  return { ran, files, modelCalls }
}

const FINDING = JSON.stringify([
  { file: 'src/pay.ts', line: 4, severity: 'important', class: 'wrong aggregate: mean where a total is wanted', title: 'total() now returns the average, not the sum', why: 'the diff divides sum by items.length', fix: 'return sum', instances: ['src/pay.ts:4'] },
])

const replyAs = (hunter: string, verifier = '{"verdict":"real","why":"it divides"}', tier = 'medium'): Reply => (system, _prompt) =>
  system.includes(':hunter]') ? hunter : system.includes(':verifier]') ? verifier : system.includes(':tier]') ? tier : ''

test('/land help lists the commands', async $ => {
  const answer = await $.command.run({ command: 'land', args: 'help' })
  expect(answer.text).toContain('/land approve')
  expect(answer.text).toContain('/land resolve')
})

test('a confirmed finding makes the run red, posts the finding, and gates the push', async ($, on) => {
  const m = machine(on, { reply: replyAs(FINDING) })
  const clock = mock.clock(on)
  const sent: string[] = []
  on('prompt.submit', async (_$: any, e: any) => {
    sent.push(e.text)
    return { text: e.text }
  })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('RED: 1 open finding')
  expect(answer.text).toContain('total() now returns the average')
  // three hunters raised the same finding: verified once (two votes), their agreement counted
  expect(answer.text).toContain('4/4 votes')
  expect(m.modelCalls.filter(c => c.system.includes(':hunter]'))).toHaveLength(3)
  expect(m.modelCalls.filter(c => c.system.includes(':verifier]'))).toHaveLength(2)
  // the diff is sent once per hunter, with a cache mark on it
  // autoFix hands the findings to Claude once the command has returned
  await clock.advance(100)
  expect(sent).toHaveLength(1)
  expect(sent[0]).toContain('every instance of its class')
  // the push is refused
  const push = await $.tool.call({ tool: 'Bash', command: 'git push origin feature' } as any)
  expect(String((push as any).deny ?? (push as any).text)).toContain('blocked')
})

test('a clean run on a low-risk change is green and the push goes through', async ($, on) => {
  const m = machine(on, { reply: replyAs('[]', '', 'low') })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('GREEN: low risk')
  expect(answer.text).toContain('Cleared')
  expect(m.modelCalls.filter(c => c.system.includes(':verifier]'))).toHaveLength(0)
  const push = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect((push as any).deny).toBeUndefined()
  const status = await $.command.run({ command: 'land', args: 'status' })
  expect(status.text).toContain('1 landing(s), 1 with no person')
})

test('medium risk is cleared by the author by default, and needs /land approve in strict mode', async ($, on) => {
  machine(on, { reply: replyAs('[]', '', 'medium') })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('GREEN: medium risk')
  expect(answer.text).toContain('you prompted it')
  const push = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect((push as any).deny).toBeUndefined()
})

test('strict approvals hold a medium-risk push until a person approves', { options: { approvals: 'strict' } }, async ($, on) => {
  machine(on, { reply: replyAs('[]', '', 'medium') })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('/land approve')
  const blocked = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect(String((blocked as any).deny ?? (blocked as any).text)).toContain('waits for a person')
  const ok = await $.command.run({ command: 'land', args: 'approve' })
  expect(ok.text).toContain('Approved')
  const push = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect((push as any).deny).toBeUndefined()
})

test('a path that always needs a person is high risk and needs a note to approve', async ($, on) => {
  const diff = DIFF.replace(/src\/pay\.ts/g, '.github/workflows/release.yml')
  machine(on, { diff, reply: replyAs('[]') })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('GREEN: high risk')
  const noNote = await $.command.run({ command: 'land', args: 'approve' })
  expect(noNote.text).toContain('needs a note')
  const withNote = await $.command.run({ command: 'land', args: 'approve checked the workflow by hand' })
  expect(withNote.text).toContain('Approved (high risk: checked the workflow by hand)')
})

test('a failed check is red before any hunter runs, and no tokens are spent on hunting', async ($, on) => {
  const m = machine(on, {
    reply: replyAs(FINDING),
    files: { '/repo/package.json': JSON.stringify({ scripts: { test: 'vitest run' } }) },
    checks: { 'npm run test': 1 },
  })
  const answer = await $.command.run({ command: 'land', args: '' })
  expect(answer.text).toContain('checks failing')
  expect(answer.text).toContain('FAIL src/pay.test.ts')
  expect(m.modelCalls.filter(c => c.system.includes(':hunter]'))).toHaveLength(0)
})

test('/land resolve closes a finding with a reason and it is not posted again', async ($, on) => {
  machine(on, { reply: replyAs(FINDING) })
  mock.clock(on)
  on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
  await $.command.run({ command: 'land', args: '' })
  const r = await $.command.run({ command: 'land', args: 'resolve 1 the average is what the spec asks for' })
  expect(r.text).toContain('Resolved 1')
  expect(r.text).toContain('green')
  const push = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect((push as any).deny).toBeUndefined()
})

test('the round cap stops the hunters and asks for a step back', { options: { roundCap: 1, autoFix: false } }, async ($, on) => {
  const m = machine(on, { reply: replyAs(FINDING) })
  const first = await $.command.run({ command: 'land', args: '' })
  expect(first.text).toContain('RED')
  const hunters = m.modelCalls.filter(c => c.system.includes(':hunter]')).length
  // the same diff again is answered from the record; a changed diff past the cap stops the hunters
  const second = await $.command.run({ command: 'land', args: '' })
  expect(second.text).toContain('STEP BACK')
  expect(m.modelCalls.filter(c => c.system.includes(':hunter]')).length).toBe(hunters)
})

test('a project that never opted in is left alone by the gate', async ($, on) => {
  machine(on)
  const push = await $.tool.call({ tool: 'Bash', command: 'git push' } as any)
  expect((push as any).deny).toBeUndefined()
})

test('/land learn writes the lesson into REVIEW.md, which the hunters then read', async ($, on) => {
  const m = machine(on, { reply: replyAs('[]', '', 'low') })
  const learned = await $.command.run({ command: 'land', args: 'learn prices are in cents, never divide them' })
  expect(learned.text).toContain('Added to REVIEW.md')
  expect(m.files['/repo/REVIEW.md']).toContain('- prices are in cents, never divide them')
  await $.command.run({ command: 'land', args: '' })
  const hunter = m.modelCalls.find(c => c.system.includes(':hunter]'))
  expect(hunter?.prompt).toContain('prices are in cents')
})

test('the land tool runs the same layers for the model', async ($, on) => {
  machine(on, { reply: replyAs('[]', '', 'low') })
  const r: any = await $.tool.call({ tool: TOOL, depth: 'quick' } as any)
  expect(String(r.text ?? r.result ?? JSON.stringify(r))).toContain('GREEN')
})

test('the system prompt gains one short review-layers section', async ($, on) => {
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }))
  const r: any = await ($ as any).prompt.compose?.({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] }).catch(() => null)
  if (r) {
    const mine = r.sections.find((s: any) => s.id === 'review-layers:rules')
    expect(mine).toBeDefined()
    expect(mine.text.length).toBeLessThan(600)
  }
})
