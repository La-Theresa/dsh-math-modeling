import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, name } from '../math-tools.mjs'

function makeCtx({ exitCodeForScript = 0, stdoutForScript = 'ok\n' } = {}) {
  let schema
  const spawned = []
  const ctx = {
    tools: {
      register(value) {
        schema = value
      },
    },
    subprocess: {
      spawn(opts) {
        spawned.push(opts)
        const isCheck = opts.argv.includes('-c')
        const exitCode = isCheck ? 0 : exitCodeForScript
        const stdout = isCheck ? 'math stack ok\n' : stdoutForScript
        const stderr = ''
        return {
          done: Promise.resolve({ exitCode }),
          collected: {
            stdout: { readFrom: () => ({ text: stdout }) },
            stderr: { readFrom: () => ({ text: stderr }) },
          },
        }
      },
    },
    logger: { warn() {} },
  }
  apply(ctx, {})
  return { schema, spawned }
}

test('exports a diagnostic plugin name', () => {
  assert.equal(name, 'math-tools')
})

test('registers exactly the math_code tool', () => {
  const { schema } = makeCtx()
  assert.ok(schema)
  assert.equal(schema.name, 'math_code')
  assert.match(schema.description, /numpy/)
  assert.match(schema.description, /sympy/)
  assert.match(schema.description, /matplotlib/)
  assert.match(schema.description, /openpyxl/)
  assert.match(schema.description, /pypdf/)
})

test('execute verifies the interpreter first, then runs a generated Python script', async () => {
  const { schema, spawned } = makeCtx()
  const result = await schema.execute({ code: 'print(7)' }, {})
  assert.equal(result.text.trim(), 'ok')
  assert.equal(spawned.length, 2)
  // First spawn is the environment self-check.
  assert.ok(spawned[0].argv.includes('-c'))
  // Second spawn is the user script.
  assert.match(spawned[1].argv[1], /script\.py$/)
})

test('non-zero exit is reported as an error with output text', async () => {
  const { schema } = makeCtx({ exitCodeForScript: 1, stdoutForScript: 'traceback line\n' })
  await assert.rejects(() => schema.execute({ code: 'raise ValueError()' }, {}), /traceback line/)
})
