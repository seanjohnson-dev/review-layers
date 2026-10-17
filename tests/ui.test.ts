import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane' as const, requestId: 'review-layers', props: { title: 'Review layers', isFocused: false, bodyColumns: 80, placement: 'inline' as const, scroll: { top: 0, bodyRows: 20 }, view: {} } }
const BAND = { component: 'AbovePrompt' as const, requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { top: 0, bodyRows: 5 }, view: {} } }

test('the pane and the band draw on every surface before any run', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ plugin: 'review-layers', surface, ...(PANE as any) })
    expect(await pane.find({ type: 'Text', text: /No review yet/ })).toBeDefined()
    await pane.unmount()
  }
})
