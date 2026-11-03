import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'savvy-progress'
const STEP = 'mcp__savvy-progress__step'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const
const usage = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// A Codex wrapper on Haiku; `briefs` collects the prompts the engine is handed.
const wrapper = async ($: Engine, on: On, subagentType: string, briefs: string[] = []) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', (_$, e) => {
    briefs.push(e.prompt)
    return { model: 'claude-haiku-5-5', agentId: 'a1' }
  })
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-haiku-5-5', ...usage } } as never
  })
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'Fix the stairs', description: 'Codex: stairs', subagentType, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
}

const step = async ($: Engine) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: 'claude-haiku-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
}

const mount = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'savvy-agents', props: pane })

test('a Codex wrapper is asked to report the Codex model', async ($, on) => {
  const briefs: string[] = []
  await wrapper($, on, 'codex', briefs)
  expect(briefs[0]).toContain(STEP)
  expect(briefs[0]).toContain('`model`')
})

test('terminal: the row names Codex and the model it reported, not the wrapper', async ($, on) => {
  await wrapper($, on, 'codex:codex-rescue')
  const r = await $.tool.call({ tool: STEP, agentId: 'a1', done: 1, total: 3, note: 'running codex', model: 'gpt-5.5-codex', effort: 'high' } as never)
  expect(r).toMatchObject({ result: 'ok' })
  // A later request of the wrapper keeps Codex's model on the row.
  await step($)
  const ui = await mount($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Codex · gpt-5\.5-codex · high/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Haiku/ })).toBeFalsy()
})

test('desktop: a Codex row wears the Codex costume', async ($, on) => {
  await wrapper($, on, 'codex')
  const ui = await mount($, 'desktop')
  const svgs = await ui.findAll({ type: 'Svg' })
  const markup = svgs.map(s => String((s.props as { svg?: string; markup?: string }).svg ?? (s.props as { markup?: string }).markup ?? JSON.stringify(s.props))).join('')
  expect(markup).toContain('c-codex')
})

test('an ordinary subagent keeps its own model and plain crab', async ($, on) => {
  await wrapper($, on, 'general-purpose')
  const ui = await mount($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /general-purpose · Haiku 5\.5/ })).toBeTruthy()
})
