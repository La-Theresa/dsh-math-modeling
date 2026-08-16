# Math Modeling Preset for DeepSeek Harness

A **mathematical modeling** preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), developed on top of **dsh-anchored-standard**.

It keeps the proven two-phase anchored bootstrap from `dsh-anchored-standard`:

1. **First request**: exact Minimal-mode anchor — Minimal persona, `bash` + `str_replace_editor`, no injected workspace/skill context.
2. **After the first durable promotion signal**: a resident toolset that includes `math_code`, discovery tools, and a rigorous mathematical modeling protocol.

## Features

- **Anchored-standard compatibility**
  - First-round tool schema is the Minimal pair: `bash`, `str_replace_editor`.
  - First-round system prompt is the Minimal persona, untouched.
  - First-round auto-injected context is suppressed.
  - Promotion is triggered by the first `tool/call` **or** the first `assistant/message`, whichever comes first (`promoteOn: either`).
  - Promotion state is derived from durable session events, so resume/reload keeps the correct phase.
  - Compaction-aware phase reset is preserved.

- **Math workbench tool: `math_code`**
  - Executes Python code with the scientific Python stack:
    - `numpy` — numerical arrays and linear algebra
    - `scipy` — scientific computing, ODE/optimization/interpolation
    - `sympy` — symbolic derivation, ODE solving, simplification
    - `matplotlib` — data visualization (Agg backend, saves PNG/SVG)
    - `pandas` — tabular data processing
    - `openpyxl` / `xlrd` — Excel read/write
    - `pypdf` / `pdfplumber` — PDF text/table extraction
    - `statsmodels` / `scikit-learn` — statistical/data-driven models
  - Returns text output and absolute paths to saved figures.
  - `read_image` is kept in the promoted resident catalog when the host provides it, so the model can inspect generated plots.

- **Rigorous mathematical modeling protocol**
  - `MATH_PROTOCOL.md` is injected as a one-time hint after promotion.
  - The hint resolves the file's absolute path inside the preset directory, so it works even when the current workspace does not contain a `math-modeling/` folder.
  - Requires:
    - first-principles modeling
    - complete derivations with motivation for every step
    - multiple modeling perspectives
    - ODE/PDE formulation and explicit vs implicit finite-difference analysis
    - stability, consistency, convergence, and conservation checks
    - boundary-condition inversion / model selection when data are incomplete
    - Pareto multi-objective optimization
    - solver acceptance gate before inversion/optimization
    - unit self-checks, numerical constraint tolerance, and reproducible results

- **Long-running task support**
  - Background job tools (`job_list`, `job_output`, `job_kill`) are kept in the promoted resident catalog when the host provides them.
  - `bash`/`math_code` descriptions tell the model to script long scans and poll logs instead of blocking on one call.

- **Jupyter / WSL workbench**
  - `workbench.ipynb` is a ready-to-use notebook template.
  - `setup-workbench.sh` creates a local virtual environment with the full Python math stack.

## Installation

Copy the whole `math-modeling` directory as a standalone preset id:

```sh
dsh_home="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home/.agent-presets"
test ! -e "$dsh_home/.agent-presets/math-modeling"
cp -R math-modeling "$dsh_home/.agent-presets/math-modeling"
```

Restart DeepSeek Harness, create a blank session, and select **Math Modeling (experimental)**.

> Do not switch an active session from a different preset to this one. Create a fresh session.

## Workbench Setup

In this repository (or after copying the preset to a project that contains `math-modeling/`):

```sh
bash math-modeling/setup-workbench.sh
math-modeling/.venv/bin/jupyter lab math-modeling/workbench.ipynb
```

The setup script creates `math-modeling/.venv`, plus `artifacts/`, `results/`, and `logs/`, and installs:

```text
numpy scipy sympy matplotlib pandas
openpyxl xlrd pypdf pdfplumber
statsmodels scikit-learn
jupyter nbformat ipykernel
```

If you already have a Python environment with these packages, set `MATH_MODELING_PYTHON` to that interpreter, or configure `pythonPath` in the `math-tools` row of `agent.cordis.yml`.

## How It Works

### Phase 1: Minimal anchor

- The first model request is intentionally minimal:
  - Minimal system prompt
  - `bash` + `str_replace_editor`
  - no AGENTS.md digest
  - no available-skills catalog injection

This preserves the trajectory anchor measured by `dsh-anchored-standard`.

### Phase 2: Promoted math modeling

After the first durable `tool/call` or `assistant/message`, the resident catalog becomes:

- `bash`
- `str_replace_editor`
- `math_code`
- `dev_tool_search`
- `skill_search`
- `skill_load`
- `read_image` (when available)
- plus any tools explicitly unlocked through `dev_tool_search`

At the same time, a one-time `math-protocol` hint tells the model to read `math-modeling/MATH_PROTOCOL.md` before starting a modeling task.

### Compaction behavior

After `compaction/end`, the session falls back to a controlled phase:

- `bash` + `str_replace_editor`
- `math_code`
- the configured `compactionTools`

until a new durable promotion signal appears past the compaction boundary.

## Updating an Installed Preset

If you already copied `math-modeling/` to `~/.dsh/.agent-presets/math-modeling` and later update this source, sync the installed copy with:

```sh
bash math-modeling/sync-installed.sh
```

Then restart DeepSeek Harness so the new `preset.yml` description and files are loaded.

## Testing

From the repository root:

```sh
npm test
```

The test suite covers:

- first-request Minimal bootstrap
- promotion from `tool/call` or `assistant/message`
- resident catalog including `math_code`
- compaction phase reset
- `math_protocol` hint injection
- `math_code` tool registration and execution flow

## Project Structure

```text
math-modeling/
├── README.md
├── LICENSE
├── NOTICE
├── preset.yml
├── agent.cordis.yml
├── MATH_PROTOCOL.md
├── math-tools.mjs          # math_code DSH tool
├── math-protocol.mjs       # post-promotion protocol hint
├── tool-bootstrap.mjs      # anchored two-phase bootstrap
├── compaction-epoch.mjs    # epoch-aware promotion state
├── instruction-hint.mjs
├── dev-tool-search.mjs
├── skill-search.mjs
├── custom-bash.mjs
├── requirements.txt
├── setup-workbench.sh
├── sync-installed.sh
├── write_notebook.py
├── workbench.ipynb
├── artifacts/          # intermediate data
├── results/            # problem*.json / summaries
├── logs/               # long-running job logs
└── test/
    ├── math-tools.test.mjs
    ├── math-protocol.test.mjs
    └── math-bootstrap.test.mjs
```

## Credits

This preset is based on **dsh-anchored-standard**, including its Minimal-anchored bootstrap, resident-tool discovery pattern, durable promotion tracking, and compaction-aware phase logic.

## License

MIT. The preset composition is derived from the DeepSeek Harness Standard preset; the original DeepSeek copyright and MIT notice are retained in [`NOTICE`](./NOTICE), and the MIT license is in [`LICENSE`](./LICENSE).
