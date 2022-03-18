import io
import json
import os
import re
from datetime import datetime
import pytz
import requests
import nbformat
import mistletoe
from mistletoe.ast_renderer import ASTRenderer


def notebook_to_notebook_id(path, notebook_data):
    _, filename = os.path.split(path)
    if 'metadata' not in notebook_data:
        return f'unknown_undefined_{filename}'
    metadata = notebook_data['metadata']
    meme = 'undefined' if 'lc_notebook_meme' not in metadata or 'current' not in metadata['lc_notebook_meme'] \
        else metadata['lc_notebook_meme']['current']
    if 'lc_notebook_meme' not in metadata \
        or 'lc_server_signature' not in metadata['lc_notebook_meme'] \
        or 'current' not in metadata['lc_notebook_meme']['lc_server_signature'] \
        or 'signature_id' not in metadata['lc_notebook_meme']['lc_server_signature']['current']:
        return f'unknown_{meme}_{filename}'
    server_sig_id = metadata['lc_notebook_meme']['lc_server_signature']['current']['signature_id']
    return f'{server_sig_id}_{meme}_{filename}'

def _meme_to_solr_document(meme):
    doc = {}
    if 'current' in meme:
        doc['lc_cell_meme__current'] = meme['current']
    if 'next' in meme:
        doc['lc_cell_meme__next'] = meme['next']
    if 'previous' in meme:
        doc['lc_cell_meme__previous'] = meme['previous']
    if 'execution_end_time' in meme:
        doc['lc_cell_meme__execution_end_time'] = meme['execution_end_time']
    return doc

def _add_field(fields, name, text):
    if name not in fields:
        fields[name] = text
        return
    if len(fields[name]) == 0:
        fields[name] = text
        return
    fields[name] += '\n' + text

def _get_markdown_text(ast):
    if ast['type'] == 'RawText':
        return ast['content']
    if 'children' not in ast:
        return ''
    r = []
    for child in ast['children']:
        r.append(_get_markdown_text(child))
    return ' '.join(r)

def markdown_ast_to_solr_fields(fields, ast, prefix=''):
    r = fields.copy()
    if ast['type'] == 'Heading':
        level = min(ast['level'], 6)
        _add_field(r, f'{prefix}heading', '#' * level + ' ' + _get_markdown_text(ast))
        _add_field(r, f'{prefix}heading_{level}', _get_markdown_text(ast))
    elif ast['type'] == 'Link':
        _add_field(r, f'{prefix}link', _get_markdown_text(ast) + ' ' + ast['target'])
        _add_field(r, f'{prefix}url', ast['target'])
    elif ast['type'] == 'RawText':
        # extract url from text
        m = re.finditer(r'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)', ast['content'])
        for url in m:
            _add_field(r, f'{prefix}url', url.group())
    elif ast['type'] == 'InlineCode':
        _add_field(r, f'{prefix}code_inline', _get_markdown_text(ast))
        _add_field(r, f'{prefix}code', _get_markdown_text(ast))
    elif ast['type'] == 'CodeFence':
        _add_field(r, f'{prefix}code_fence', _get_markdown_text(ast))
        _add_field(r, f'{prefix}code', _get_markdown_text(ast))
    elif ast['type'] == 'Emphasis':
        _add_field(r, f'{prefix}emphasis_1', _get_markdown_text(ast))
        _add_field(r, f'{prefix}emphasis', _get_markdown_text(ast))
    elif ast['type'] == 'Strong':
        _add_field(r, f'{prefix}emphasis_2', _get_markdown_text(ast))
        _add_field(r, f'{prefix}emphasis', _get_markdown_text(ast))
    if 'children' not in ast:
        return r
    for child in ast['children']:
        r = markdown_ast_to_solr_fields(r, child, prefix=prefix)
    return r

def _retrieve_markdown_content(ast, header_pattern):
    target = None
    if 'children' not in ast:
        return None
    for child in ast['children']:
        if child['type'] == 'Heading':
            if target is not None:
                return '\n'.join(target)
            if header_pattern.search(_get_markdown_text(child)) is not None:
                target = []
            continue
        if target is None:
            continue
        target.append(_get_markdown_text(child))
    if target is not None:
        return '\n'.join(target)
    for child in ast['children']:
        t = _retrieve_markdown_content(child, header_pattern)
        if t is not None:
            return t
    return None

def _contains_markdown(fields, name, keywords):
    if name not in fields:
        return False
    return any([k in fields[name].lower() for k in keywords])

def markdown_to_solr_fields(markdown, prefix=''):
    ast = json.loads(mistletoe.markdown(markdown, ASTRenderer))
    r = {}
    r = markdown_ast_to_solr_fields(r, ast, prefix=prefix)

    operation_note = _retrieve_markdown_content(
        ast,
        re.compile(r'Operation\s*Note', re.IGNORECASE)
    )
    if operation_note is not None:
        r[f'{prefix}operation_note'] = operation_note
    if _contains_markdown(r, f'{prefix}heading', ['about']):
        r[f'{prefix}about'] = markdown
    if _contains_markdown(r, f'{prefix}emphasis', ['todo', 'tbd']):
        r[f'{prefix}todo'] = markdown
    return r

def cell_to_solr_document(notebook_id, path, cell, cell_index, notebook_attr=None):
    doc = {
        'id': notebook_id + f'_{cell_index}',
        'index': cell_index,
        'notebook_id': notebook_id,
        'notebook_filename': path,
    }
    if notebook_attr is not None:
        doc.update([(f'notebook_{k}', v)
                    for k, v in notebook_attr.items()
                    if k in ['server', 'owner', 'ctime', 'atime', 'mtime']])
    top_fields = ['cell_type', 'execution_count']
    for top_field in top_fields:
        if top_field not in cell:
            continue
        if cell[top_field] is None:
            continue
        doc[top_field] = cell[top_field]
    if 'metadata' in cell and 'lc_cell_meme' in cell['metadata']:
        doc.update(_meme_to_solr_document(cell['metadata']['lc_cell_meme']))
    if cell['cell_type'] == 'code' and 'source' in cell:
        code = ''.join(cell['source'])
        doc['source__code'] = code
        doc['source'] = code
    if cell['cell_type'] == 'markdown' and 'source' in cell:
        markdown = ''.join(cell['source'])
        doc['source__markdown'] = markdown
        doc['source'] = markdown
        doc.update(markdown_to_solr_fields(markdown, prefix='source__markdown__'))
    doc['_text_'] = doc['source'] if 'source' in doc else ''
    if 'notebook_mtime' in doc or 'lc_cell_meme__execution_end_time' in doc:
        doc['estimated_mtime'] = doc['lc_cell_meme__execution_end_time'] if 'lc_cell_meme__execution_end_time' in doc else doc['notebook_mtime']
    if 'outputs' not in cell:
        return doc
    for output in cell['outputs']:
        if 'output_type' in output and output['output_type'] == 'execute_result':
            if 'data' in output and 'text/plain' in output['data']:
                doc['outputs__result_plain'] = ''.join(output['data']['text/plain'])
            if 'data' in output and 'text/html' in output['data']:
                doc['outputs__result_html'] = ''.join(output['data']['text/html'])
            continue
        if 'name' not in output or output['name'] not in ['stdout', 'stderr']:
            continue
        doc['outputs__{}'.format(output['name'])] = ''.join(output['text'])
    doc['outputs'] = ' '.join([doc[k] for k in sorted(doc.keys()) if k.split('_')[0] == 'outputs'])
    doc['_text_'] += '\n' + doc['outputs']
    return doc

def notebook_to_solr_document(path, notebook_data, attr=None, user_pattern=None):
    notebook_id = notebook_to_notebook_id(path, notebook_data)
    _, filename = os.path.split(path)
    doc = {
        'id': notebook_id,
        'filename': filename,
    }
    if attr is not None:
        doc.update(attr)
    memes = []
    if 'cells' not in notebook_data:
        return doc
    execution_end_times = []
    doc['source'] = ''
    doc['outputs'] = ''
    for i, cell in enumerate(notebook_data['cells']):
        if 'metadata' in cell and 'lc_cell_meme' in cell['metadata'] and 'current' in cell['metadata']['lc_cell_meme']:
            memes.append(cell['metadata']['lc_cell_meme']['current'])
        fields = cell_to_solr_document(notebook_id, path, cell, i)
        for k, v in fields.items():
            if k == 'lc_cell_meme__execution_end_time':
                execution_end_times.append(v)
                continue
            if k.split('_')[0] not in ['outputs', 'source']:
                continue
            _add_field(doc, k, v)
    doc['lc_cell_memes'] = ' '.join(memes)
    if len(execution_end_times) > 0:
        doc['lc_cell_meme__execution_end_time'] = sorted(execution_end_times)[-1]
    doc['_text_'] = doc['filename'] + '\n' + doc['source'] + '\n' + doc['outputs']
    if 'source__markdown__heading' in doc:
        doc['source__markdown__heading_count'] = str(len(doc['source__markdown__heading'].split('\n')))
    else:
        doc['source__markdown__heading_count'] = '0'
    return doc

def _get_notebook_attr(notebook_data, base_attr=None):
    attr = {}
    if base_attr is not None:
        attr.update([(k, v) for k, v in base_attr.items() if v is not None and len(v) > 0])
    if 'metadata' in notebook_data and 'lc_notebook_meme' in notebook_data['metadata']:
        lc_notebook_meme = notebook_data['metadata']['lc_notebook_meme']
        if 'current' in lc_notebook_meme:
            attr['lc_notebook_meme__current'] = lc_notebook_meme['current']
        if 'lc_server_signature' in lc_notebook_meme and 'current' in lc_notebook_meme['lc_server_signature']:
            lc_server_signature = lc_notebook_meme['lc_server_signature']['current']
            if 'notebook_path' in lc_server_signature:
                attr['signature_notebook_path'] = lc_server_signature['notebook_path']
            if 'server_url' in lc_server_signature:
                attr['signature_server_url'] = lc_server_signature['server_url']
            if 'signature_id' in lc_server_signature:
                attr['signature_id'] = lc_server_signature['signature_id']
    return attr

def ipynb_to_documents(path, notebook_data, attr=None, user_pattern=None):
    notebook_attr = _get_notebook_attr(notebook_data, base_attr=attr)
    notebook_docs = notebook_to_solr_document(path, notebook_data, attr=notebook_attr, user_pattern=user_pattern)
    notebook_id = notebook_to_notebook_id(path, notebook_data)
    if 'cells' not in notebook_data:
        return {
            'jupyter-notebook': [notebook_docs],
        }
    cell_docs = [cell_to_solr_document(notebook_id, path, cell, cell_index, notebook_attr=notebook_attr)
                 for cell_index, cell in enumerate(notebook_data['cells'])]
    return {
        'jupyter-cell': cell_docs,
        'jupyter-notebook': [notebook_docs],
    }
