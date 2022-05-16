# jupyter-cell core

The jupyter-cell core is a core for managing indexes for a single cell.

## Configuration

The configuration file can be found in the [conf](conf/) directory.

## Fields

| Field Name | Type | Description |
| ---------- | ----- | ---- |
| id | string | ID of a Cell. Identify a Cell by (Notebook MEME ID)-(file name)-(cell index) |
| \_text_ | text_ja | Cell content and output |
| notebook_id | string | ID of the Notebook to which the cell belongs: (Notebook MEME ID)-(file name)-(cell index) |
| notebook_atime | date | atime of the notebook |
| notebook_mtime | date | mtime of the notebook |
| notebook_ctime | date | ctime of the notebook |
| notebook_owner | text_user | owner of the notebook |
| notebook_filename | string | filename of the notebook |
| notebook_server | url | server of the notebook |
| index | int | Index of the cell. 0 for the first cell |
| cell_type | string | Type of cell: code or markdown |
| execution_count | int | Execution count |
| lc_cell_meme__current | text_meme | Value of the current field in the lc_cell_meme metadata |
| lc_cell_meme__next | text_meme | Value of the next field in the lc_cell_meme metadata |
| lc_cell_meme__previous | text_meme | Value of previous field in lc_cell_meme metadata |
| lc_cell_meme__execution_end_time | date | Value of the execution_end_time field in the lc_cell_meme metadata |
| estimated_mtime | date | The value of lc_cell_meme__execution_end_time, if any. If not, the value of notebook_mtime |
| source | text_ja | Cell content (regardless of markdown/code) |
| source__code | text_script | Contents for code cell |
| source__markdown | text_ja | Contents for markdown cell |
| source__markdown__heading_1 | text_ja | For markdown cell, the heading (level 1) string |
| source__markdown__heading_2 | text_ja | For markdown cell, the heading (level 2) string |
| source__markdown__heading_3 | text_ja | For markdown cell, the heading (level 3) string |
| source__markdown__heading_4 | text_ja | For markdown cell, the heading (level 4) string |
| source__markdown__heading_5 | text_ja | For markdown cell, the heading (level 5) string |
| source__markdown__heading_6 | text_ja | For markdown cell, the heading (level 6) string |
| source__markdown__heading | text_ja | For markdown cell, string of heading (all levels) |
| source__markdown__link | text_ja | For markdown cell, display string of links |
| source__markdown__url | text_ja | For markdown cell, URLs contained in the content |
| source__markdown__code_inline | text_ja | For markdown cell, inline code |
| source__markdown__code_fence | text_ja | For markdown cell, code block |
| source__markdown__code | text_ja | For markdown cell, code |
| source__markdown__emphasis_1 | text_ja | For markdown cell, emphasized1 (italic) string |
| source__markdown__emphasis_2 | text_ja | For markdown cell, emphasized2 (bold) string |
| source__markdown__emphasis | text_ja | For markdown cell, emphasized string |
| source__markdown__operation_note | text_ja | For markdown cell, the content that followed after the *Operation Note* in the heading |
| source__markdown__todo | text_ja | For markdown cell, content containing highlighted TODO, TBD, etc. strings |
| source__markdown__about | text_ja | For markdown cell, a heading string starting with About: |
| outputs | text_ja | Output string (for all execution results/stdout/stderr) |
| outputs__stdout | text_ja | Standard output content |
| outputs__stderr | text_ja | Standard error output |
| outputs__result_plain | text_ja | Execution results saved in `text/plain` |
| outputs__result_html | text_ja | Execution results saved in `text/html` |
