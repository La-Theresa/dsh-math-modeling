/**
 * math-tools — a general Python math workbench tool for the math-modeling
 * preset.
 *
 * `math_code` runs user/model-written Python code with the mathematical
 * stack installed in the preset's virtual environment:
 *
 *   - sympy      symbolic mathematics
 *   - numpy      numerical arrays and vectorized linear algebra
 *   - scipy      scientific computing
 *   - matplotlib data visualization
 *   - pandas     tabular data handling
 *   - openpyxl/xlrd/pypdf/pdfplumber  Excel and PDF data ingestion
 *   - statsmodels/scikit-learn        statistical/data-driven models
 *
 * The tool deliberately stays GENERAL instead of exposing one narrow tool per
 * library: mathematical modeling needs a single flexible surface where a
 * derivation, a numerical solve, and a plot can share state in one script.
 *
 * Environment policy:
 *  - `resolvePython` NEVER silently falls back to a system Python that lacks
 *    the required stack.
 *  - Every candidate interpreter is verified with an import self-check before
 *    being used.
 *  - If no usable interpreter is found, `math_code` returns a clear setup
 *    message instead of a bare `ModuleNotFoundError`.
 *
 * Security/trust: like `bash`, this tool executes arbitrary Python. The preset
 * has shell-equivalent trust; users should review the preset before installing.
 */

import { randomUUID } from 'node:crypto'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'math-tools'

/** The subprocess and tools services must exist before this tool can register. */
export const inject = ['subprocess', 'tools']

const DEFAULT_MAX_OUTPUT_BYTES = 200000

/** Modules that must be importable before math_code will run. */
const REQUIRED_MODULES = [
  'numpy',
  'scipy',
  'sympy',
  'matplotlib',
  'pandas',
  'openpyxl',
  'pypdf',
  'pdfplumber',
  'statsmodels',
  'sklearn',
]

/**
 * Prepended to every user script. Keeps matplotlib's cache in a writable temp
 * directory and forces the non-interactive Agg backend for server/WSL use.
 */
const PYTHON_PREAMBLE = `import os, sys, tempfile
os.environ.setdefault("MPLCONFIGDIR", tempfile.mkdtemp(prefix="mplconfig-"))
try:
    import matplotlib
    matplotlib.use("Agg")
except Exception:
    pass
`

/** Python one-liner used to verify that a candidate interpreter has the stack. */
const CHECK_CODE = [
  'import importlib.util, sys',
  'mods = ' + JSON.stringify(REQUIRED_MODULES),
  'missing = [m for m in mods if importlib.util.find_spec(m) is None]',
  'if missing:',
  '    print("missing: " + ", ".join(missing), file=sys.stderr)',
  '    sys.exit(1)',
  'print("math stack ok")',
].join('\n')

/** Tool parameter schema for the model-facing Python runner. */
const codeSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: [
        'Python code to execute. Available: numpy, scipy, sympy, matplotlib, pandas, openpyxl, xlrd, pypdf, pdfplumber, statsmodels, scikit-learn.',
        'Print text results with print(...). Save figures to files (e.g. output.png / output.svg) and print their absolute paths.',
        'Do not rely on interactive display; use Agg backend for matplotlib and savefig().',
      ].join('\n'),
    },
    workdir: {
      type: 'string',
      description: 'Optional working directory for file outputs. Defaults to the session cwd.',
    },
    timeout_ms: {
      type: 'integer',
      description: 'Optional timeout in milliseconds for this call. Use for long scans; otherwise the host default applies.',
    },
  },
  required: ['code'],
  additionalProperties: false,
}

/** Run a Python process and collect stdout/stderr. */
async function runPython(ctx, argv, { cwd, signal, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}) {
  const handle = ctx.subprocess.spawn({
    argv,
    ...cwd !== undefined ? { cwd } : {},
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: maxOutputBytes },
      stderr: { maxBytes: maxOutputBytes },
    },
    ...signal !== undefined ? { signal } : {},
    graceMs: 3000,
  })
  let outcome
  try {
    outcome = await handle.done
  } catch (error) {
    throw new Error(`math_code spawn failed: ${String(error)}`)
  }
  let stdout = ''
  let stderr = ''
  try {
    stdout = handle.collected.stdout.readFrom(0).text
    stderr = handle.collected.stderr.readFrom(0).text
  } catch {
    // Collected readers may be unavailable on some backends; tolerate.
  }
  return { exitCode: outcome.exitCode, stdout, stderr }
}

/** Verify that a candidate interpreter can import the required math stack. */
async function verifyMathStack(ctx, python) {
  const { exitCode, stderr } = await runPython(ctx, [python, '-c', CHECK_CODE], { maxOutputBytes: 8192 })
  return { ok: exitCode === 0, stderr }
}

/** Resolve a Python interpreter that actually has the required stack. */
async function resolvePython(ctx, config) {
  const cfg = config ?? {}
  const here = dirname(fileURLToPath(import.meta.url))
  const cwd = process.cwd()
  const candidates = [
    typeof cfg.pythonPath === 'string' && cfg.pythonPath.length > 0 ? cfg.pythonPath : undefined,
    process.env.MATH_MODELING_PYTHON,
    join(here, '.venv', 'bin', 'python'),
    join(here, '..', '.venv', 'bin', 'python'),
    join(cwd, '.venv', 'bin', 'python'),
    join(cwd, 'math-modeling', '.venv', 'bin', 'python'),
    'python3',
  ].filter(Boolean)

  const tried = []
  for (const candidate of candidates) {
    const full = candidate.includes('/') || candidate.includes('\\') || candidate === '.' || candidate.startsWith('.')
      ? resolve(cwd, candidate)
      : candidate
    try {
      await access(full)
    } catch {
      tried.push(`${full} (not found)`)
      continue
    }
    try {
      const check = await verifyMathStack(ctx, full)
      if (check.ok) return full
      tried.push(`${full} (missing: ${check.stderr.trim()})`)
    } catch (error) {
      tried.push(`${full} (${String((error && error.message) || error)})`)
    }
  }

  throw new Error([
    'math_code environment is not ready.',
    'No Python interpreter with the required math stack was found.',
    `Checked candidates: ${tried.join('; ') || 'none'}`,
    '',
    'Fix with one of:',
    '  bash math-modeling/setup-workbench.sh',
    '  .venv/bin/python -m pip install -r math-modeling/requirements.txt',
    '  set MATH_MODELING_PYTHON to a Python with numpy/scipy/sympy/matplotlib/pandas/openpyxl/pypdf/pdfplumber/statsmodels/scikit-learn',
  ].join('\n'))
}

/** Register the math_code tool. */
export function apply(ctx, config) {
  const maxOutputBytes = Number.isSafeInteger(config?.maxOutputBytes) && config.maxOutputBytes > 0 ? config.maxOutputBytes : DEFAULT_MAX_OUTPUT_BYTES

  ctx.tools.register({
    name: 'math_code',
    description: [
      'Execute Python mathematical modeling code with numpy, scipy, sympy, matplotlib, pandas, openpyxl, pypdf, pdfplumber, statsmodels, and scikit-learn.',
      '',
      'Use this for symbolic derivation, numerical computation, differential-equation solving, implicit finite-difference schemes, parameter fitting, sensitivity analysis, Excel/PDF data ingestion, and data visualization.',
      '',
      'Guidelines:',
      '- Print all text results with print(...).',
      '- For plots, save with `plt.savefig(path)` and print the absolute path.',
      '- The working directory defaults to the session cwd; pass `workdir` to place output files elsewhere.',
      '- Each call is a fresh Python process; persist data by writing files or by carrying results in the conversation.',
      '- For long scans, pass `timeout_ms` and prefer writing scripts + logs over interactive single calls.',
    ].join('\n'),
    parameters: codeSchema,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args, exec) {
      const python = await resolvePython(ctx, config)
      const cwd = typeof args.workdir === 'string' && args.workdir.length > 0
        ? args.workdir
        : exec?.agent?.session?.header?.cwd
      const tempDir = await mkdtemp(join(tmpdir(), `math-code-${randomUUID()}-`))
      const scriptPath = join(tempDir, 'script.py')
      try {
        await writeFile(scriptPath, PYTHON_PREAMBLE + args.code, 'utf8')

        let signal
        const timeoutMs = Number.isSafeInteger(args.timeout_ms) && args.timeout_ms > 0 ? args.timeout_ms : undefined
        const timeoutSignal = timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined
        if (exec?.signal !== undefined && timeoutSignal !== undefined) {
          signal = AbortSignal.any([exec.signal, timeoutSignal])
        } else {
          signal = exec?.signal ?? timeoutSignal
        }

        const { exitCode, stdout, stderr } = await runPython(ctx, [python, scriptPath], {
          cwd,
          signal,
          maxOutputBytes,
        })
        const text = [stdout, stderr].filter((part) => part.length > 0).join('\n')
        const tail = text.length > 0 ? text : `exit code: ${exitCode} (no output)`
        if (exitCode !== 0) {
          throw new Error(tail)
        }
        return { text: tail }
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    },
  })
}
