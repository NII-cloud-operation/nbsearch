# jupyter-notebook core

The jupyter-notebook core is a core for managing indexes for a notebook.

## Configuration

The configuration file can be found in the [conf](conf/) directory.

## Fields

| Field Name | Type | Description |
| ---------- | ----- | ---- |
| id | string | Notebook ID: (Notebook MEME ID)-(file name)-(cell index) |
| \_text_ | text_ja | The notebook file name, cell contents and outputs |
| atime | date | Last access time of the notebook file |
| mtime | date | Last modified time of the notebook file |
| ctime | date | Creation time of the notebook file |
| owner | text_user | Owner name of the notebook file (user name) |
| filename | string | Name of the notebook file (including path) |
| server | url | Server URL where the notebook is located |
| signature_notebook_path | string | The notebook path recorded by nblineage |
| signature_server_url | url | Server URL recorded by nblineage |
| signature_id | string | signature_id of the server recorded by nblineage |
| lc_notebook_meme__current | text_meme | Value of the current field in the lc_notebook_meme metadata |
| lc_cell_memes | text_meme | The concatenation of all the values of the lc_cell_meme__current field of the cell to which it belongs |
| lc_cell_meme__execution_end_time | date | Maximum value of lc_cell_meme__execution_end_time of the cell to which it belongs |
| source__code | text_script | The concatenation of all the values of the source__code field of the cell to which it belongs |
| source__markdown | text_ja | The concatenation of all the values of the source__markdown field of the cell to which it belongs |
| source__markdown__heading_1 | text_ja | The concatenation of all the values of the source__markdown__heading1 field of the cell to which it belongs |
| source__markdown__heading_2 | text_ja | The concatenation of all the values of the source__markdown__heading2 field of the cell to which it belongs |
| source__markdown__heading_3 | text_ja | The concatenation of all the values of the source__markdown__heading3 field of the cell to which it belongs |
| source__markdown__heading_4 | text_ja | The concatenation of all the values of the source__markdown__heading4 field of the cell to which it belongs |
| source__markdown__heading_5 | text_ja | The concatenation of all the values of the source__markdown__heading5 field of the cell to which it belongs |
| source__markdown__heading_6 | text_ja | The concatenation of all the values of the source__markdown__heading6 field of the cell to which it belongs |
| source__markdown__heading_count | long | The total number of headings in the cell to which it belongs |
| source__markdown__heading | text_ja | The concatenation of all the values of the source__markdown__heading field of the cell to which it belongs |
| source__markdown__link | text_ja | The concatenation of all the values of the source__markdown__link field of the cell to which it belongs |
| source__markdown__url | text_ja | The concatenation of all the values of the source__markdown__url field of the cell to which it belongs |
| source__markdown__code_inline | text_ja | The concatenation of all the values of the source__markdown__code_inline field of the cell to which it belongs |
| source__markdown__code_fence | text_ja | The concatenation of all the values of the source__markdown__code_fence field of the cell to which it belongs |
| source__markdown__code | text_ja | The concatenation of all the values of the source__markdown__code field of the cell to which it belongs |
| source__markdown__emphasis_1 | text_ja | The concatenation of all the values of the source__markdown__emphasis_1 field of the cell to which it belongs |
| source__markdown__emphasis_2 | text_ja | The concatenation of all the values of the source__markdown__emphasis_2 field of the cell to which it belongs |
| source__markdown__emphasis | text_ja | The concatenation of all the values of the source__markdown__emphasis field of the cell to which it belongs. |
| source__markdown__operation_note | text_ja | The concatenation of all the values of the source__markdown__operation_note field of the cell to which it belongs |
| source__markdown__todo | text_ja | The concatenation of all the values of the source__markdown__todo field of the cell to which it belongs. |
| source__markdown__about | text_ja | The concatenation of all the values of the source__markdown__about field of the cell to which it belongs |
| source | text_ja | The concatenation of all the values of the source field of the cell to which it belongs. |
| outputs__stdout | text_ja | The concatenation of all the values of the outputs__stdout field of the cell to which it belongs |
| outputs__stderr | text_ja | The concatenation of all the values of the outputs__stderr field of the cell to which it belongs |
| outputs__result_plain | text_ja | The concatenation of all values in the outputs__result_plain field of the cell to which it belongs |
| outputs__result_html | text_ja | The concatenation of all values in the outputs__result_html field of the cell to which it belongs |
| outputs | text_ja | The concatenation of all the values of the outputs field of the cell to which it belongs |
