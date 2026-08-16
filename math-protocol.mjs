/**
 * math-protocol — post-promotion one-time hint pointing to MATH_PROTOCOL.md.
 *
 * WHY: the math-modeling preset wants a rigorous modeling methodology, but the
 * first request must stay Minimal-anchored (no extra system prompt or injected
 * context). This plugin therefore waits until the session is promoted and then
 * injects ONE short hint telling the model where to read `MATH_PROTOCOL.md`.
 *
 * PATH RESOLUTION:
 *  The protocol file ships inside the preset directory. The hint resolves its
 *  absolute path from this plugin's own module location, so it works even when
 *  the preset is installed under `~/.dsh/.agent-presets/math-modeling` and the
 *  model's current workspace does NOT contain a `math-modeling/` folder.
 *
 * Behavior:
 *  - Pre-promotion requests get NO hint (preserves the anchored bootstrap).
 *  - After the first durable promotion signal (`promoteOn`, default `either`),
 *    the hint is injected once per session (in-memory, same pattern as the
 *    existing instruction-hint plugin).
 *  - The hint source kind is `math-protocol`, which is not in
 *    `suppressedContextSources`, so it is never stripped by the bootstrap.
 *  - A failure to inject simply skips the hint; it never breaks a request.
 */

import { fileURLToPath } from 'node:url'
import { createEpochPromotion } from './compaction-epoch.mjs'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'math-protocol'

/** Durable session event types that count as a promotion signal per mode. */
const PROMOTE_EVENTS = {
  'tool-call': ['tool/call'],
  'assistant-message': ['assistant/message'],
  either: ['tool/call', 'assistant/message'],
}

function parsePromoteOn(value) {
  if (value === undefined || value === 'either') return PROMOTE_EVENTS.either
  if (value === 'tool-call' || value === 'assistant-message') return PROMOTE_EVENTS[value]
  throw new TypeError(`${name}: promoteOn must be one of "tool-call", "assistant-message", "either"; got ${JSON.stringify(value)}`)
}

/** Absolute path to MATH_PROTOCOL.md inside this preset directory. */
const PROTOCOL_PATH = fileURLToPath(new URL('./MATH_PROTOCOL.md', import.meta.url))

/** Register the post-promotion math-protocol hint injector. */
export function apply(ctx, config) {
  const promoteEvents = parsePromoteOn(config.promoteOn)
  const promotion = createEpochPromotion(promoteEvents)
  ctx.on('session/event', (session, event) => promotion.observe(session, event))

  /** Sessions that already received the hint. */
  const hinted = new Set()
  let warned = false
  const warnOnce = (message) => {
    if (warned) return
    warned = true
    try {
      ctx.logger.warn(message)
    } catch {
      // Logger unavailable — the guard exists only to avoid spamming.
    }
  }

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    try {
      if (promotion.status(agent).promoted !== true) return decision
      const session = agent.session
      if (session === undefined || hinted.has(session.id)) return decision
      hinted.add(session.id)

      const text = [
        '数学建模协议已就绪：请在开始数学建模任务前阅读以下协议文件。',
        `协议文件绝对路径：\`${PROTOCOL_PATH}\``,
        '如果当前工作区存在 `math-modeling/MATH_PROTOCOL.md`，也可以读取该相对路径；否则请直接读取上面的绝对路径。',
        '开始前请确认环境：运行 `bash math-modeling/setup-workbench.sh`，或检查 `math-modeling/.venv/bin/python` 可导入 numpy/scipy/sympy/matplotlib/pandas/openpyxl/pypdf/pdfplumber/statsmodels/sklearn。',
        '严格遵循其中的工作流：从第一性原理出发，明确假设与符号，考虑多种建模角度；',
        '定解条件不完备时先做边界条件反演/模型选择；涉及微分方程时比较显式/隐式差分并分析稳定性与收敛性；',
        '多目标问题必须做 Pareto 分析；长任务写成脚本并用后台任务运行，避免单次调用超时。',
        '每一步都要给出动机、推导过程和验证。',
      ].join(' ')

      return {
        ...decision,
        messages: [...decision.messages, {
          id: `math-protocol-${session.id}`,
          role: 'user',
          content: [{ type: 'text', text }],
          source: { kind: 'math-protocol', form: 'hint' },
        }],
      }
    } catch (error) {
      warnOnce(`${name}: hint injection failed, skipping: ${String((error && error.message) || error)}`)
      return decision
    }
  }, { prepend: true })
}
