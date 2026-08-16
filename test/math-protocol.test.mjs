import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, name } from '../math-protocol.mjs'

function register() {
  const listeners = {}
  const hookOptions = {}
  const ctx = {
    on(event, callback, options) {
      listeners[event] = callback
      hookOptions[event] = options
    },
    logger: { warn() {} },
  }
  apply(ctx, { promoteOn: 'either' })
  return { listeners, hookOptions }
}

const session = (events) => ({ id: 's', events })

const decision = () => ({
  kind: 'enter',
  messages: [{ id: 'u', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } }],
})

test('exports a diagnostic plugin name', () => {
  assert.equal(name, 'math-protocol')
})

test('pre-promotion requests get NO math protocol hint', async () => {
  const { listeners } = register()
  const d = decision()
  const result = await listeners['agent/pre-step'](
    { agent: { session: session([]) } },
    async () => d,
  )
  assert.equal(result, d)
})

test('after promotion ONE hint is injected once per session', async () => {
  const { listeners } = register()
  const agent = { session: session([{ type: 'assistant/message', seq: 1, data: {} }]) }
  const first = await listeners['agent/pre-step']({ agent }, async () => decision())
  assert.equal(first.messages.length, 2)
  const hint = first.messages[1]
  assert.equal(hint.source.kind, 'math-protocol')
  assert.match(hint.content[0].text, /MATH_PROTOCOL\.md/)
  assert.match(hint.content[0].text, /绝对路径/)
  // Second call for the same session: no duplicate hint.
  const second = await listeners['agent/pre-step']({ agent }, async () => decision())
  assert.equal(second.messages.length, 1)
})

test('the hint registers with prepend', () => {
  const { hookOptions } = register()
  assert.deepEqual(hookOptions['agent/pre-step'], { prepend: true })
})
