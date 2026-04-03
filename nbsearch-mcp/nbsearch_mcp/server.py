"""nbsearch MCP server.

Exposes Jupyter Notebook search (Solr) and retrieval (S3) as MCP tools
with a layered overview-to-detail drill-down following nblibram's philosophy:

  search → toc → section → cell output

Usage:
    python -m nbsearch_mcp.server                                  # stdio
    python -m nbsearch_mcp.server --transport http --port 8000     # Streamable HTTP
"""

from __future__ import annotations

import json
import os

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .config import load_config
from .db import NBSearchDB
from .notebook import build_toc, extract_section, get_cell_output as _get_cell_output

mcp = FastMCP(
    "nbsearch",
    instructions="""\
This server searches and retrieves Jupyter Notebooks stored in Solr and S3.

## Query syntax

Queries use Solr query syntax. A bare keyword searches the default full-text
field (_text_), which covers filenames, cell sources, and outputs with Japanese
tokenization. Use field:value to target specific fields.

### search_notebooks fields

  filename           — notebook filename (exact string)
  owner              — notebook owner
  server             — Jupyter server URL
  mtime / ctime      — modified/created time (date range: [2024-01-01T00:00:00Z TO *])
  source__code       — code cell content (standard tokenizer)
  source__markdown   — markdown cell content (Japanese tokenizer)
  source__markdown__heading    — all headings
  source__markdown__heading_1  — h1 headings (also _2 through _6)
  source__markdown__hashtags   — hashtags (e.g. #pandas, #データ分析)
  source__markdown__url        — URLs in markdown
  outputs            — all cell outputs
  outputs__stdout    — stdout output
  outputs__stderr    — stderr output
  lc_notebook_meme__current — notebook MEME ID (UUID, lineage tracking)
  lc_cell_memes      — all cell MEME IDs in the notebook

### search_cells fields

  cell_type          — "code" or "markdown"
  notebook_filename  — parent notebook filename
  notebook_owner     — parent notebook owner
  notebook_mtime     — parent notebook modified time
  source__code       — code cell source
  source__markdown   — markdown cell source
  source__markdown__heading_1  — h1 in cell (also _2 through _6)
  source__markdown__hashtags   — hashtags in cell
  outputs__stdout    — stdout
  outputs__stderr    — stderr
  execution_count    — cell execution count
  estimated_mtime    — cell modification time estimate
  lc_cell_meme__current   — cell MEME ID (UUID, lineage tracking)
  lc_cell_meme__previous  — MEME of the preceding cell
  lc_cell_meme__next      — MEME of the following cell

### MEME (lineage tracking)

Each notebook and cell has a MEME — a UUID assigned at creation that persists
through copies. When a notebook is copied to a different environment, branch
suffixes are appended (e.g. 437c8d0a-...-1-branch1), so use the base UUID
to find all copies regardless of branching.

  - Find all notebooks containing a specific cell:
    search_notebooks with "lc_cell_memes:437c8d0a-0862-11e7-8c9a-0242ac110002"
  - Find all copies/derivatives of a cell across notebooks:
    search_cells with "lc_cell_meme__current:437c8d0a-0862-11e7-8c9a-0242ac110002"
    (the MEME tokenizer matches the base UUID, ignoring branch suffixes)
  - Find cells adjacent to a known cell in their original notebook:
    search_cells with "lc_cell_meme__previous:<meme>" or "lc_cell_meme__next:<meme>"

### Examples

  "pandas"                                      — full-text search
  "source__code:pandas AND owner:yazawa"        — code containing pandas by yazawa
  "source__markdown__heading_1:設定"             — notebooks with h1 heading matching 設定
  "source__markdown__hashtags:#データ分析"       — notebooks tagged #データ分析
  "mtime:[2024-01-01T00:00:00Z TO *]"           — modified since 2024
  "cell_type:code AND outputs__stderr:Error"    — code cells with errors

## Usage flow

Use tools in this order — overview first, then drill down:

1. search_notebooks / search_cells — find notebooks or cells by keyword.
2. get_notebook_toc — get the table of contents for a notebook.
3. get_notebook_section — get the full content of a section.
4. get_cell_output — get detailed execution output of a specific cell.

Always start broad (search/toc) before requesting full content (section/output).
""",
)

_config = load_config()
_db = NBSearchDB(_config)


# ---- Layer 0: Search (entry point) -----------------------------------


def _pick_notebook_fields(doc: dict) -> dict:
    """Return only the fields useful for an overview."""
    return {
        "id": doc["id"],
        "filename": doc["filename"],
        "owner": doc.get("owner"),
        "server": doc.get("server"),
        "mtime": doc.get("mtime"),
        "headings": doc.get("source__markdown__heading", ""),
    }


@mcp.tool()
async def search_notebooks(
    query: str,
    q_op: str = "AND",
    start: int = 0,
    limit: int = 10,
    sort: str | None = None,
) -> str:
    """Search notebooks by keyword. Accepts Solr query syntax.

    Examples:
      - "pandas"               : full-text search
      - "source__code:pandas"  : search within code cells
      - "owner:yazawa"         : filter by owner

    Returns lightweight overview only (id, filename, owner, headings).
    Drill down via get_notebook_toc → get_notebook_section for details.
    """
    result = await _db.query_notebooks(
        query, q_op=q_op, start=start, rows=limit, sort=sort,
    )
    response = result["response"]
    return json.dumps(
        {
            "notebooks": [_pick_notebook_fields(d) for d in response["docs"]],
            "numFound": response["numFound"],
            "start": start,
        },
        ensure_ascii=False,
    )


def _pick_cell_fields(doc: dict) -> dict:
    """Return lightweight cell summary for search results."""
    source = doc.get("source", "")
    lines = source.split("\n") if source else []
    preview = "\n".join(lines[:5])
    if len(lines) > 5:
        preview += "\n..."
    return {
        "id": doc["id"],
        "notebook_id": doc["notebook_id"],
        "notebook_filename": doc["notebook_filename"],
        "cell_type": doc["cell_type"],
        "index": doc["index"],
        "source_preview": preview,
    }


@mcp.tool()
async def search_cells(
    query: str,
    q_op: str = "AND",
    start: int = 0,
    limit: int = 10,
    sort: str | None = None,
) -> str:
    """Search at cell level. Can search code and markdown cells individually.

    Examples:
      - "cell_type:code AND source__code:pandas"
      - "source__markdown__heading_1:Setup"

    Returns first 5 lines of source only. Use get_notebook_section for full content.
    """
    result = await _db.query_cells(
        query, q_op=q_op, start=start, rows=limit, sort=sort,
    )
    response = result["response"]
    return json.dumps(
        {
            "cells": [_pick_cell_fields(d) for d in response["docs"]],
            "numFound": response["numFound"],
            "start": start,
        },
        ensure_ascii=False,
    )


# ---- Layer 1: TOC (overview) -----------------------------------------


@mcp.tool()
async def get_notebook_toc(notebook_id: str) -> str:
    """Get the table of contents of a notebook.

    Returns heading hierarchy, code cell count per section, and preview text.
    Use this to understand the overall structure, then drill down into
    specific sections via get_notebook_section.
    """
    notebook = await _db.download_notebook(notebook_id)
    toc = build_toc(notebook)

    filename = notebook_id.rsplit("_", 1)[-1] if "_" in notebook_id else notebook_id
    cells = notebook["cells"]
    cell_count = len(cells)
    code_cell_count = sum(1 for c in cells if c["cell_type"] == "code")

    return json.dumps(
        {
            "notebook_id": notebook_id,
            "filename": filename,
            "cell_count": cell_count,
            "code_cell_count": code_cell_count,
            "toc": toc,
        },
        ensure_ascii=False,
    )


# ---- Layer 2: Section (narrative detail) ------------------------------


@mcp.tool()
async def get_notebook_section(
    notebook_id: str,
    heading: str | None = None,
    cell_index: int | None = None,
) -> str:
    """Get cells of a specific section, preserving narrative structure.

    Specify by heading (substring match) or cell_index.
    Returns markdown and code cells together. Code cell outputs are
    summarized only. Use get_cell_output for full output detail.

    Examples:
      - get_notebook_section(notebook_id="...", heading="Data Preprocessing")
      - get_notebook_section(notebook_id="...", cell_index=5)
    """
    if heading is None and cell_index is None:
        return json.dumps({"error": "Either heading or cell_index must be provided"})

    notebook = await _db.download_notebook(notebook_id)
    cells = extract_section(notebook, heading=heading, cell_index=cell_index)

    if not cells:
        return json.dumps({"error": "No matching section found"})

    return json.dumps(
        {
            "notebook_id": notebook_id,
            "cells": cells,
        },
        ensure_ascii=False,
    )


# ---- Layer 3: Cell output (deepest detail) ---------------------------


@mcp.tool()
async def get_cell_output(
    notebook_id: str,
    cell_index: int,
) -> str:
    """Get full execution output of a specific cell.

    Returns stdout/stderr, execution results, and error tracebacks as text.
    Binary outputs (images, etc.) are reported as MIME type and size only.
    """
    notebook = await _db.download_notebook(notebook_id)
    result = _get_cell_output(notebook, cell_index)
    return json.dumps(result, ensure_ascii=False)


# ---- Entry point ------------------------------------------------------


def main():
    import argparse

    parser = argparse.ArgumentParser(description="nbsearch MCP server")
    parser.add_argument(
        "--transport", choices=["stdio", "http"], default="stdio",
        help="Transport type (default: stdio)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="HTTP host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port (default: 8000)")
    parser.add_argument("--allowed-host", action="append", default=[], help="Allowed Host header values (repeatable)")
    args = parser.parse_args()

    if args.transport == "http":
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        if args.allowed_host:
            mcp.settings.transport_security = TransportSecuritySettings(
                allowed_hosts=args.allowed_host,
            )
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
