"""nbsearch MCP server.

Exposes Jupyter Notebook search (Solr) and retrieval (S3) as MCP tools
with a layered overview-to-detail drill-down following nblibram's philosophy:

  search → get_notebook → get_cell_output

Usage:
    python -m nbsearch_mcp.server                                  # stdio
    python -m nbsearch_mcp.server --transport http --port 8000     # Streamable HTTP
"""

from __future__ import annotations

import itertools
import json
import os

from cachetools import TTLCache
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .config import load_config
from .db import NBSearchDB
from .notebook import build_toc, extract_section, get_cell_output as _get_cell_output

mcp = FastMCP(
    "nbsearch",
    instructions="""\
This server searches and retrieves Jupyter Notebooks stored in Solr and S3.

## Search parameters

search_notebooks and search_cells accept structured parameters (all optional,
combined with AND):

  phrase    — phrase search across all fields (code, markdown, outputs)
  code      — phrase search within code cells
  markdown  — phrase search within markdown cells
  owner     — filter by notebook owner
  filename  — filter by notebook filename
  date_from — modified since (YYYY-MM-DD)
  date_to   — modified until (YYYY-MM-DD)
  freetext  — raw Solr query for advanced use (combined via AND with above)

search_cells additionally accepts:
  cell_type — "code" or "markdown"

### freetext (advanced)

The freetext parameter accepts raw Solr query syntax for cases not covered
by structured parameters. Available Solr fields:

  Notebook: source__markdown__heading_1 (also _2 through _6),
    source__markdown__hashtags, source__markdown__url,
    outputs__stdout, outputs__stderr,
    lc_notebook_meme__current, lc_cell_memes
  Cell: lc_cell_meme__current, lc_cell_meme__previous, lc_cell_meme__next,
    execution_count

### MEME (lineage tracking, use via freetext)

Each notebook and cell has a MEME — a UUID assigned at creation that persists
through copies. When copied to a different environment, branch suffixes are
appended (e.g. 437c8d0a-...-1-branch1). The base UUID matches all copies.

  freetext="lc_cell_memes:437c8d0a-0862-11e7-8c9a-0242ac110002"
    → find notebooks containing a specific cell
  freetext="lc_cell_meme__current:437c8d0a-0862-11e7-8c9a-0242ac110002"
    → find all copies of a cell across notebooks

## Usage flow

1. search_notebooks / search_cells — find notebooks or cells.
   search_notebooks returns each notebook with its table of contents.
   Each TOC entry has a "ref" (e.g. "s0", "s3").
2. get_notebook(ref="s3") — read section content using the ref from step 1.
3. get_cell_output — inspect execution output of a specific cell.

Always start with search before requesting full content.
""",
)

_config = load_config()
_db = NBSearchDB(_config)

# ref -> (notebook_id, cell_index) mapping, TTL 1 hour
_section_refs: TTLCache = TTLCache(maxsize=4096, ttl=3600)
_ref_counter = itertools.count()


def _register_ref(notebook_id: str, cell_index: int) -> str:
    ref = f"s{next(_ref_counter)}"
    _section_refs[ref] = (notebook_id, cell_index)
    return ref


# ---- Layer 0: Search (entry point) -----------------------------------


async def _notebook_summary(doc: dict, cell_query: str | None = None) -> dict:
    """Build a notebook summary with TOC and matching cells."""
    notebook_id = doc["id"]
    notebook = await _db.download_notebook(notebook_id)
    cells = notebook["cells"]
    toc = build_toc(notebook)
    for entry in toc:
        entry["ref"] = _register_ref(notebook_id, entry["cell_index"])

    matching_cells: list[dict] = []
    if cell_query and cell_query != "*:*":
        q = f'notebook_id:"{notebook_id}" AND {cell_query}'
        result = await _db.query_cells(q, rows=3, sort="estimated_mtime desc")
        for cdoc in result["response"]["docs"]:
            source = cdoc.get("source__code") or cdoc.get("source__markdown") or ""
            lines = source.split("\n") if source else []
            preview = "\n".join(lines[:5])
            if len(lines) > 5:
                preview += "\n..."
            matching_cells.append({
                "cell_type": cdoc["cell_type"],
                "index": cdoc["index"],
                "source_preview": preview,
            })

    return {
        "filename": doc["filename"],
        "owner": doc.get("owner"),
        "server": doc.get("server"),
        "mtime": doc.get("mtime"),
        "ctime": doc.get("ctime"),
        "atime": doc.get("atime"),
        "lc_notebook_meme__current": doc.get("lc_notebook_meme__current"),
        "operation_note": doc.get("source__markdown__operation_note"),
        "about": doc.get("source__markdown__about"),
        "cell_count": len(cells),
        "code_cell_count": sum(1 for c in cells if c["cell_type"] == "code"),
        "toc": toc,
        "matching_cells": matching_cells,
    }


_NOTEBOOK_FIELDS = {
    "owner": "owner",
    "filename": "filename",
    "mtime": "mtime",
}

_CELL_FIELDS = {
    "owner": "notebook_owner",
    "filename": "notebook_filename",
    "mtime": "estimated_mtime",
}


def _build_query(
    *,
    fields: dict[str, str],
    phrase: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    freetext: str | None = None,
) -> str:
    """Build a Solr query from structured parameters."""
    parts: list[str] = []
    if phrase:
        parts.append(f'"{phrase}"')
    if code:
        parts.append(f'source__code:"{code}"')
    if markdown:
        parts.append(f'source__markdown:"{markdown}"')
    if owner:
        parts.append(f"{fields['owner']}:{owner}")
    if filename:
        parts.append(f'{fields["filename"]}:"{filename}"')
    if date_from or date_to:
        fr = f"{date_from}T00:00:00Z" if date_from else "*"
        to = f"{date_to}T23:59:59Z" if date_to else "*"
        parts.append(f"{fields['mtime']}:[{fr} TO {to}]")
    if freetext:
        parts.append(freetext)
    return " AND ".join(parts) if parts else "*:*"


@mcp.tool()
async def search_notebooks(
    phrase: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    freetext: str | None = None,
    start: int = 0,
    limit: int = 20,
    sort: str = "mtime desc",
) -> str:
    """Search notebooks. All parameters are optional and combined with AND.

    Structured parameters (phrase search):
      - phrase    : phrase search across all fields (code, markdown, outputs)
      - code      : phrase search within code cells
      - markdown  : phrase search within markdown cells
      - owner     : filter by notebook owner (token search, handles name variants)
      - filename  : filter by notebook filename
      - date_from : modified since (YYYY-MM-DD)
      - date_to   : modified until (YYYY-MM-DD)

    Free-text parameter (raw Solr query, token-split search):
      - freetext  : raw Solr query, combined with other parameters via AND

    Results are sorted by modification time (newest first) by default.
    Returns each notebook with its table of contents (heading hierarchy,
    code cell counts, preview). Use get_notebook to read a section.
    """
    query = _build_query(
        fields=_NOTEBOOK_FIELDS,
        phrase=phrase, code=code, markdown=markdown,
        owner=owner, filename=filename,
        date_from=date_from, date_to=date_to, freetext=freetext,
    )
    cell_query = _build_query(
        fields=_CELL_FIELDS,
        phrase=phrase, code=code, markdown=markdown,
        date_from=date_from, date_to=date_to, freetext=freetext,
    )
    result = await _db.query_notebooks(
        query, start=start, rows=limit, sort=sort,
    )
    response = result["response"]
    notebooks = [await _notebook_summary(d, cell_query) for d in response["docs"]]
    return json.dumps(
        {
            "notebooks": notebooks,
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
    phrase: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    cell_type: str | None = None,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    freetext: str | None = None,
    start: int = 0,
    limit: int = 20,
    sort: str = "estimated_mtime desc",
) -> str:
    """Search at cell level. All parameters are optional and combined with AND.

    Structured parameters (phrase search):
      - phrase    : phrase search across all cell fields
      - code      : phrase search within code cells
      - markdown  : phrase search within markdown cells
      - cell_type : "code" or "markdown"
      - owner     : filter by notebook owner (token search)
      - filename  : filter by notebook filename
      - date_from : modified since (YYYY-MM-DD)
      - date_to   : modified until (YYYY-MM-DD)

    Free-text parameter (raw Solr query, token-split search):
      - freetext  : raw Solr query, combined with other parameters via AND

    Results are sorted by estimated modification time (newest first) by default.
    Returns first 5 lines of source only. Use get_notebook for full content.
    """
    base = _build_query(
        fields=_CELL_FIELDS,
        phrase=phrase, code=code, markdown=markdown,
        owner=owner, filename=filename,
        date_from=date_from, date_to=date_to, freetext=freetext,
    )
    parts: list[str] = []
    if base != "*:*":
        parts.append(base)
    if cell_type:
        parts.append(f"cell_type:{cell_type}")
    query = " AND ".join(parts) if parts else "*:*"
    result = await _db.query_cells(
        query, start=start, rows=limit, sort=sort,
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


# ---- Section (narrative detail) ----------------------------------------


@mcp.tool()
async def get_notebook(
    ref: str,
) -> str:
    """Get notebook content for a section identified by ref.

    Pass the ref from a search_notebooks TOC entry (e.g. "s0", "s3").
    Returns all cells from the heading to the next heading of equal or
    higher level: markdown cells with full source, code cells with full
    source and output summary (type, size, preview).
    Use get_cell_output for full execution output.
    """
    notebook_id, cell_index = _section_refs[ref]  # KeyError if expired/invalid
    notebook = await _db.download_notebook(notebook_id)
    cells = extract_section(notebook, cell_index=cell_index)
    return json.dumps(
        {
            "ref": ref,
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
