#!/usr/bin/env python
"""Append markdown and/or code cells to a Jupyter notebook.

This helper makes it easy for the model or user to persist each modeling stage
into the project notebook without manually editing JSON.

Usage:
  python write_notebook.py notebook.ipynb --markdown "# Stage 1\\n\\nnotes..."
  python write_notebook.py notebook.ipynb --code "x = 1\\nprint(x)"
  python write_notebook.py notebook.ipynb --markdown "..." --code "..."

The notebook is created if it does not exist.
"""

from __future__ import annotations

import argparse
import sys

import nbformat as nbf


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("notebook", help="path to .ipynb file")
    parser.add_argument("--markdown", help="markdown cell text to append")
    parser.add_argument("--code", help="code cell text to append")
    args = parser.parse_args()

    try:
        nb = nbf.read(args.notebook, as_version=4)
    except FileNotFoundError:
        nb = nbf.v4.new_notebook()
        nb.metadata["kernelspec"] = {
            "display_name": "Python 3 (Math Modeling)",
            "language": "python",
            "name": "python3",
        }

    if args.markdown:
        nb.cells.append(nbf.v4.new_markdown_cell(args.markdown))
    if args.code:
        nb.cells.append(nbf.v4.new_code_cell(args.code))
    if not args.markdown and not args.code:
        print("Nothing to append: pass --markdown and/or --code", file=sys.stderr)
        return 2

    nbf.write(nb, args.notebook)
    print(f"Updated notebook: {args.notebook}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
