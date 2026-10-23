"""nbsearch MCP server.

Exposes Jupyter Notebook search (Solr) and retrieval (S3) as MCP tools
with a layered overview-to-detail drill-down following nblibram's philosophy:

  search → get_notebook → get_cell_output

Usage:
    python -m nbsearch_mcp.server                                  # stdio
    python -m nbsearch_mcp.server --transport http --port 8000     # Streamable HTTP
"""

from __future__ import annotations

import functools
import itertools
import json
import logging
import os
import time

from cachetools import TTLCache
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .config import load_config
from .db import NBSearchDB
from .notebook import build_toc

logger = logging.getLogger(__name__)


def _log_elapsed(fn):
    @functools.wraps(fn)
    async def wrapper(*args, **kwargs):
        t0 = time.monotonic()
        result = await fn(*args, **kwargs)
        elapsed = time.monotonic() - t0
        logger.info("%s completed in %.2fs", fn.__name__, elapsed)
        return result
    return wrapper


mcp = FastMCP(
    "nbsearch",
    instructions="""\
This server searches and retrieves Jupyter Notebooks stored in Solr and S3.

1. search_notebooks — find notebooks. Returns TOC and matching_cells, each with "ref".
2. search_cells(ref="s3") — read cells using a ref from step 1. Returns full source and outputs.

Always start with search_notebooks.
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
        entry["ref"] = _register_ref(notebook_id, entry.pop("cell_index"))

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
                "ref": _register_ref(notebook_id, cdoc["index"]),
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
    text: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    exact: bool = False,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    """Build a Solr query from structured parameters."""
    def _q(value: str) -> str:
        return f'"{value}"' if exact else value

    parts: list[str] = []
    if text:
        parts.append(_q(text))
    if code:
        parts.append(f"source__code:{_q(code)}")
    if markdown:
        parts.append(f"source__markdown:{_q(markdown)}")
    if owner:
        parts.append(f"{fields['owner']}:{owner}")
    if filename:
        parts.append(f'{fields["filename"]}:"{filename}"')
    if date_from or date_to:
        fr = f"{date_from}T00:00:00Z" if date_from else "*"
        to = f"{date_to}T23:59:59Z" if date_to else "*"
        parts.append(f"{fields['mtime']}:[{fr} TO {to}]")
    return " AND ".join(parts) if parts else "*:*"


@mcp.tool()
@_log_elapsed
async def search_notebooks(
    exact: bool,
    text: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    start: int = 0,
    limit: int = 10,
    sort: str = "mtime desc",
) -> str:
    """Search notebooks. Parameters are combined with AND.

      - exact     : (required) if true, text/code/markdown match exact phrase
                    (use true for hyphenated terms like "cloudop-users",
                     use false for natural language queries)
      - text      : search across all fields (code, markdown, outputs)
      - code      : search within code cells
      - markdown  : search within markdown cells
      - owner     : filter by notebook owner
      - filename  : filter by notebook filename
      - date_from : modified since (YYYY-MM-DD)
      - date_to   : modified until (YYYY-MM-DD)

    Results are sorted by modification time (newest first) by default.
    Returns each notebook with its table of contents and matching cells.
    """
    query = _build_query(
        fields=_NOTEBOOK_FIELDS,
        text=text, code=code, markdown=markdown, exact=exact,
        owner=owner, filename=filename,
        date_from=date_from, date_to=date_to,
    )
    cell_query = _build_query(
        fields=_CELL_FIELDS,
        text=text, code=code, markdown=markdown, exact=exact,
        date_from=date_from, date_to=date_to,
    )
    result = await _db.query_notebooks(
        query, start=start, rows=limit, sort=sort,
    )
    response = result["response"]
    notebooks = [await _notebook_summary(d, cell_query) for d in response["docs"]]
    return json.dumps(
        {
            "notebooks": notebooks,
            "returned": len(notebooks),
            "numFound": response["numFound"],
            "start": start,
        },
        ensure_ascii=False,
    )


def _cell_detail(doc: dict) -> dict:
    """Extract full cell content from a Solr cell document."""
    result = {
        "notebook_id": doc["notebook_id"],
        "notebook_filename": doc["notebook_filename"],
        "cell_type": doc["cell_type"],
        "index": doc["index"],
        "source": doc.get("source__code") or doc.get("source__markdown") or "",
    }
    # Include outputs if present
    for key in ("outputs__stdout", "outputs__stderr", "outputs__result_plain"):
        val = doc.get(key)
        if val:
            result[key] = val
    return result


@mcp.tool()
@_log_elapsed
async def search_cells(
    exact: bool,
    ref: str | None = None,
    text: str | None = None,
    code: str | None = None,
    markdown: str | None = None,
    cell_type: str | None = None,
    owner: str | None = None,
    filename: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    start: int = 0,
    limit: int = 5,
    sort: str = "estimated_mtime desc",
) -> str:
    """Search cells and return full content. Parameters are combined with AND.

      - exact     : (required) if true, text/code/markdown match exact phrase
                    (use true for hyphenated terms like "cloudop-users",
                     use false for natural language queries)
      - ref       : ref from search_notebooks TOC or matching_cells — scopes to
                    cells around that position in the same notebook
      - text      : search across all cell fields
      - code      : search within code cells
      - markdown  : search within markdown cells
      - cell_type : "code" or "markdown"
      - owner     : filter by notebook owner
      - filename  : filter by notebook filename
      - date_from : modified since (YYYY-MM-DD)
      - date_to   : modified until (YYYY-MM-DD)

    Returns full source and outputs (stdout, stderr, result) for each cell.
    """
    base = _build_query(
        fields=_CELL_FIELDS,
        text=text, code=code, markdown=markdown, exact=exact,
        owner=owner, filename=filename,
        date_from=date_from, date_to=date_to,
    )
    parts: list[str] = []
    if base != "*:*":
        parts.append(base)
    if ref:
        notebook_id, cell_index = _section_refs[ref]  # KeyError if expired
        parts.append(f'notebook_id:"{notebook_id}"')
        half = limit // 2
        idx_from = max(0, cell_index - half)
        idx_to = cell_index + half
        parts.append(f"index:[{idx_from} TO {idx_to}]")
    if cell_type:
        parts.append(f"cell_type:{cell_type}")
    query = " AND ".join(parts) if parts else "*:*"
    result = await _db.query_cells(
        query, start=start, rows=limit, sort="index asc" if ref else sort,
    )
    response = result["response"]
    cells = [_cell_detail(d) for d in response["docs"]]
    return json.dumps(
        {
            "cells": cells,
            "returned": len(cells),
            "numFound": response["numFound"],
            "start": start,
        },
        ensure_ascii=False,
    )


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
