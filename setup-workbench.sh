#!/usr/bin/env bash
# Set up the math-modeling Python workbench.
#
# Creates a local virtual environment at math-modeling/.venv, installs the
# packages needed by math_code and workbench.ipynb, and creates the project
# artifact directories used by the MATH_PROTOCOL workflow.
#
# Mirror / China network:
#   By default this script uses Tsinghua PyPI mirror.
#   Override with:  PIP_INDEX_URL=https://pypi.org/simple bash math-modeling/setup-workbench.sh
#
# Usage:
#   bash math-modeling/setup-workbench.sh
set -euo pipefail

cd "$(dirname "$0")"

PYPI_MIRROR="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install --index-url "$PYPI_MIRROR" -r requirements.txt

# Project-local persistent directories. Everything that matters must live here,
# not in /tmp, so shell timeouts and restarts do not destroy intermediate work.
mkdir -p artifacts results logs

echo
echo "Math workbench ready."
echo "  Python: $(pwd)/.venv/bin/python"
echo "  Notebook: $(pwd)/workbench.ipynb"
echo "  Start Jupyter with: $(pwd)/.venv/bin/jupyter lab workbench.ipynb"
echo "  Artifact dirs: $(pwd)/artifacts, $(pwd)/results, $(pwd)/logs"
