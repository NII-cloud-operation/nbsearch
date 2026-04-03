"""Notebook parsing utilities for the overview-to-detail drill-down.

Extracts TOC, sections, and cell outputs from raw notebook JSON,
following nblibram's philosophy: notebooks are computational narratives,
code cells don't stand alone — surrounding markdown provides context.
"""

from __future__ import annotations

import re
from typing import Any


# ---- Heading extraction -----------------------------------------------

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)", re.MULTILINE)


def _extract_headings(source: str) -> list[tuple[int, str]]:
    """Return [(level, text), ...] from markdown source."""
    return [(len(m.group(1)), m.group(2).strip()) for m in _HEADING_RE.finditer(source)]


def _first_words(text: str, n: int = 20) -> str:
    words = text.split()
    if len(words) <= n:
        return text.strip()
    return " ".join(words[:n]) + " ..."


# ---- TOC --------------------------------------------------------------


def build_toc(notebook: dict) -> list[dict]:
    """Build a table-of-contents from notebook cells.

    Returns a list of section entries, each with:
      heading, level, cell_index, code_cell_count, preview
    """
    cells = notebook["cells"]
    sections: list[dict] = []

    for i, cell in enumerate(cells):
        if cell["cell_type"] != "markdown":
            continue
        source = "".join(cell["source"])
        for level, text in _extract_headings(source):
            sections.append(
                {
                    "heading": text,
                    "level": level,
                    "cell_index": i,
                    "code_cell_count": 0,
                    "preview": "",
                }
            )

    for si, sec in enumerate(sections):
        start = sec["cell_index"]
        end = sections[si + 1]["cell_index"] if si + 1 < len(sections) else len(cells)
        code_count = 0
        preview_parts: list[str] = []
        for ci in range(start, end):
            c = cells[ci]
            if c["cell_type"] == "code":
                code_count += 1
            elif c["cell_type"] == "markdown" and ci == start:
                src = "".join(c["source"])
                lines = src.split("\n")
                body_lines = [
                    ln for ln in lines if not ln.strip().startswith("#")
                ]
                preview_parts.append(" ".join(body_lines).strip())
        sec["code_cell_count"] = code_count
        sec["preview"] = _first_words(" ".join(preview_parts))

    return sections


# ---- Section extraction -----------------------------------------------


def extract_section(
    notebook: dict,
    *,
    heading: str | None = None,
    cell_index: int | None = None,
) -> list[dict]:
    """Extract a section's cells preserving narrative structure.

    Finds the section by heading text (substring match) or cell_index,
    then returns all cells from the heading to the next heading of
    equal or higher level — mirroring nblibram's section command.
    """
    cells = notebook["cells"]
    if not cells:
        return []

    start_idx: int | None = None
    start_level: int | None = None

    if cell_index is not None:
        start_idx = cell_index
        src = "".join(cells[cell_index]["source"])
        headings = _extract_headings(src)
        if headings:
            start_level = headings[0][0]
    elif heading is not None:
        for i, cell in enumerate(cells):
            if cell["cell_type"] != "markdown":
                continue
            src = "".join(cell["source"])
            for level, text in _extract_headings(src):
                if heading.lower() in text.lower():
                    start_idx = i
                    start_level = level
                    break
            if start_idx is not None:
                break

    if start_idx is None:
        return []

    end_idx = len(cells)
    if start_level is not None:
        for i in range(start_idx + 1, len(cells)):
            c = cells[i]
            if c["cell_type"] != "markdown":
                continue
            src = "".join(c["source"])
            for level, _ in _extract_headings(src):
                if level <= start_level:
                    end_idx = i
                    break
            if end_idx != len(cells):
                break

    result: list[dict] = []
    for i in range(start_idx, end_idx):
        cell = cells[i]
        entry: dict[str, Any] = {
            "cell_index": i,
            "cell_type": cell["cell_type"],
            "source": "".join(cell["source"]),
        }
        if cell["cell_type"] == "code":
            entry["execution_count"] = cell.get("execution_count")
            entry["output_summary"] = _summarize_outputs(cell.get("outputs", []))
        result.append(entry)

    return result


# ---- Output helpers ----------------------------------------------------


def _summarize_outputs(outputs: list[dict]) -> list[dict]:
    """Summarize cell outputs: type and size, no heavy content."""
    summaries: list[dict] = []
    for out in outputs:
        out_type = out["output_type"]
        summary: dict[str, Any] = {"output_type": out_type}

        if out_type == "stream":
            text = "".join(out["text"])
            summary["name"] = out["name"]
            summary["length"] = len(text)
            summary["preview"] = _first_words(text, 30)
        elif out_type in ("execute_result", "display_data"):
            data = out["data"]
            summary["mime_types"] = list(data.keys())
            if "text/plain" in data:
                plain = "".join(data["text/plain"])
                summary["text_preview"] = _first_words(plain, 30)
        elif out_type == "error":
            summary["ename"] = out["ename"]
            summary["evalue"] = out["evalue"]

        summaries.append(summary)
    return summaries


def get_cell_output(notebook: dict, cell_index: int) -> dict:
    """Get full output detail for a specific cell."""
    cells = notebook["cells"]
    cell = cells[cell_index]  # IndexError if out of range — fail fast

    result: dict[str, Any] = {
        "cell_index": cell_index,
        "cell_type": cell["cell_type"],
        "source": "".join(cell["source"]),
        "outputs": [],
    }

    for out in cell.get("outputs", []):
        out_type = out["output_type"]
        entry: dict[str, Any] = {"output_type": out_type}

        if out_type == "stream":
            entry["name"] = out["name"]
            entry["text"] = "".join(out["text"])
        elif out_type in ("execute_result", "display_data"):
            data = out["data"]
            entry["mime_types"] = list(data.keys())
            for mime in ("text/plain", "text/html", "text/markdown"):
                if mime in data:
                    entry[mime] = "".join(data[mime])
            for mime, content in data.items():
                if mime.startswith(("image/", "application/")):
                    raw = "".join(content) if isinstance(content, list) else content
                    entry.setdefault("binary", []).append(
                        {"mime_type": mime, "size_bytes": len(raw)}
                    )
        elif out_type == "error":
            entry["ename"] = out["ename"]
            entry["evalue"] = out["evalue"]
            entry["traceback"] = out["traceback"]

        result["outputs"].append(entry)

    return result
