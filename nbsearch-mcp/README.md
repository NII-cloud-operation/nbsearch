# nbsearch-mcp

MCP server for searching and retrieving Jupyter Notebooks backed by Solr (full-text search) and S3 (notebook storage).

## Setup

```bash
pip install -e .
```

## Usage

```bash
# stdio (default)
python -m nbsearch_mcp.server

# Streamable HTTP (for Open WebUI, etc.)
python -m nbsearch_mcp.server --transport http --port 8000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLR_BASE_URL` | Solr base URL | `http://localhost:8983` |
| `SOLR_BASIC_AUTH_USERNAME` | Solr Basic Auth username | (empty) |
| `SOLR_BASIC_AUTH_PASSWORD` | Solr Basic Auth password | (empty) |
| `S3_ENDPOINT_URL` | S3 endpoint URL | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key | (required) |
| `S3_SECRET_KEY` | S3 secret key | (required) |
| `S3_REGION_NAME` | S3 region name | (none) |
| `S3_BUCKET_NAME` | S3 bucket name | `notebooks` |

## Tools

Designed for progressive drill-down from overview to detail.

### search_notebooks

Search notebooks by keyword. Accepts Solr query syntax.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | str | (required) | Solr query (e.g. `"pandas"`, `"source__code:pandas AND owner:yazawa"`) |
| `q_op` | str | `"AND"` | Query operator |
| `start` | int | `0` | Pagination offset |
| `limit` | int | `10` | Number of results |
| `sort` | str | none | Sort field (e.g. `"mtime desc"`) |

Returns: `id`, `filename`, `owner`, `server`, `mtime`, `headings`

### search_cells

Search at cell level.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | str | (required) | Solr query (e.g. `"cell_type:code AND source__code:pandas"`) |
| `q_op` | str | `"AND"` | Query operator |
| `start` | int | `0` | Pagination offset |
| `limit` | int | `10` | Number of results |
| `sort` | str | none | Sort field |

Returns: `id`, `notebook_id`, `notebook_filename`, `cell_type`, `index`, `source_preview` (first 5 lines)

### get_notebook_toc

Get the table of contents of a notebook.

| Parameter | Type | Description |
|-----------|------|-------------|
| `notebook_id` | str | Notebook ID from search results |

Returns: `filename`, `cell_count`, `code_cell_count`, `toc` (heading hierarchy with code cell counts and preview)

### get_notebook_section

Get cells of a specific section, preserving narrative structure (markdown + code pairs).

| Parameter | Type | Description |
|-----------|------|-------------|
| `notebook_id` | str | Notebook ID |
| `heading` | str | Heading text (substring match) |
| `cell_index` | int | Or specify by cell index |

Either `heading` or `cell_index` must be provided.

Returns: Array of markdown and code cells. Code cell outputs are summarized (type and size only).

### get_cell_output

Get full execution output of a specific cell.

| Parameter | Type | Description |
|-----------|------|-------------|
| `notebook_id` | str | Notebook ID |
| `cell_index` | int | Cell index |

Returns: `source`, `outputs` (text outputs in full, binary outputs as MIME type and size only)

## Expected Usage Flow

```
search_notebooks / search_cells   -- Search (lightweight overview)
        ↓
get_notebook_toc                   -- Understand overall structure
        ↓
get_notebook_section               -- Read section content
        ↓
get_cell_output                    -- Inspect execution results
```
