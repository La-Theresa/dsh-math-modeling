import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, name } from '../tool-bootstrap.mjs'

const config = {
  bootstrapTools: ['bash', 'str_replace_editor'],
}

function register(cfg = config) {
  const listeners = {}
  const ctx = {
    on(event, callback) {
      listeners[event] = callback
    },
    logger: { warn() {} },
  }
  apply(ctx, cfg)
  return { listeners }
}

const agent = (events, id = 's') => ({ session: { id, events } })

function assemble(listener, events, tools, id = 's') {
  return listener(undefined, { agent: agent(events, id) }, async () => ({ system: 'minimal persona', tools }))
}

const TOOLS = [
  { name: 'bash' },
  { name: 'str_replace_editor' },
  { name: 'math_code' },
  { name: 'dev_tool_search' },
  { name: 'skill_search' },
  { name: 'skill_load' },
  { name: 'read_image' },
  { name: 'job_list' },
  { name: 'job_output' },
  { name: 'job_kill' },
  { name: 'web_search' },
]

test('exports a diagnostic plugin name', () => {
  assert.equal(name, 'math-tool-bootstrap')
})

test('first request exposes exactly the Minimal tool pair (no math tools)', async () => {
  const { listeners } = register()
  const result = await assemble(listeners['system-prompt/assemble'], [], TOOLS)
  assert.deepEqual(result.tools.map((tool) => tool.name), ['bash', 'str_replace_editor'])
})

test('a first assistant message promotes the resident set including math_code', async () => {
  const { listeners } = register()
  const result = await assemble(listeners['system-prompt/assemble'], [{ type: 'assistant/message', data: {} }], TOOLS)
  const names = result.tools.map((tool) => tool.name)
  assert.ok(names.includes('math_code'))
  assert.ok(names.includes('dev_tool_search'))
  assert.ok(names.includes('skill_search'))
  assert.ok(names.includes('skill_load'))
  assert.ok(names.includes('read_image'))
  assert.ok(names.includes('job_list'))
  assert.ok(names.includes('job_output'))
  assert.ok(names.includes('job_kill'))
  assert.ok(!names.includes('web_search'))
})

test('a durable tool call also promotes', async () => {
  const { listeners } = register()
  const result = await assemble(listeners['system-prompt/assemble'], [{ type: 'tool/call', data: { name: 'bash' } }], TOOLS)
  assert.ok(result.tools.some((tool) => tool.name === 'math_code'))
})

test('post-compaction falls back to bootstrap pair plus compactionTools until re-promotion', async () => {
  const { listeners } = register({ ...config, compactionTools: ['read'] })
  const tools = [...TOOLS, { name: 'read' }]
  const events = [
    { type: 'assistant/message', seq: 1, data: {} },
    { type: 'compaction/end', seq: 2 },
  ]
  const result = await assemble(listeners['system-prompt/assemble'], events, tools)
  const names = result.tools.map((tool) => tool.name)
  assert.deepEqual(names.sort(), ['bash', 'read', 'str_replace_editor'])
})
