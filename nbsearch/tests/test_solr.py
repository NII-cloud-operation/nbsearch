from nbsearch.solr import cell_to_solr_document


def test_cell_to_solr_document():
    cells = [
        {
            'cell_type': 'markdown',
            'source': ['No headings'],
        },
        {
            'cell_type': 'markdown',
            'source': ['No headings with metadata'],
            'metadata': {
                'lc_cell_meme': {
                    'next': 'CURRENT_METADATA_2',
                    'current': 'CURRENT_METADATA_1',
                },
            },
        },
        {
            'cell_type': 'code',
            'source': ['# Python Code'],
            'metadata': {
                'lc_cell_meme': {
                    'next': 'CURRENT_METADATA_3',
                    'previous': 'CURRENT_METADATA_1',
                    'current': 'CURRENT_METADATA_2',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Appendix for code'],
            'metadata': {
                'lc_cell_meme': {
                    'next': 'CURRENT_METADATA_4',
                    'previous': 'CURRENT_METADATA_2',
                    'current': 'CURRENT_METADATA_3',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Appendix for code (2)'],
            'metadata': {
                'lc_cell_meme': {
                    'next': 'CURRENT_METADATA_5',
                    'previous': 'CURRENT_METADATA_3',
                    'current': 'CURRENT_METADATA_4',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['# Section - 1'],
            'metadata': {
                'lc_cell_meme': {
                    'next': 'CURRENT_METADATA_6',
                    'previous': 'CURRENT_METADATA_4',
                    'current': 'CURRENT_METADATA_5',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Content (1-1)'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_5',
                    'current': 'CURRENT_METADATA_6',
                    'next': 'CURRENT_METADATA_7',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Content (1-2)'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_6',
                    'current': 'CURRENT_METADATA_7',
                    'next': 'CURRENT_METADATA_8',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['## Subsection'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_7',
                    'current': 'CURRENT_METADATA_8',
                    'next': 'CURRENT_METADATA_9',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['# Section - 2'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_8',
                    'current': 'CURRENT_METADATA_9',
                    'next': 'CURRENT_METADATA_10',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Content (2-1)'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_9',
                    'current': 'CURRENT_METADATA_10',
                    'next': 'CURRENT_METADATA_11',
                },
            },
        },
    ]
    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[0],
        0,
    )
    assert sorted(list(doc.keys())) == [
        '_text_', 'cell_type', 'id', 'index', 'notebook_filename', 'notebook_id',
        'source', 'source__markdown'
    ]
    assert doc['_text_'] == 'No headings'
    assert doc['cell_type'] == 'markdown'
    assert doc['id'] == 'NOTEBOOK_ID_0'
    assert doc['index'] == 0
    assert doc['notebook_filename'] == 'path/to/notebook'
    assert doc['notebook_id'] == 'NOTEBOOK_ID'
    assert doc['source'] == 'No headings'
    assert doc['source__markdown'] == 'No headings'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[1],
        1,
    )
    assert sorted(list(doc.keys())) == [
        '_text_', 'cell_type', 'id', 'index', 'lc_cell_meme__current',
        'lc_cell_meme__next', 'notebook_filename', 'notebook_id', 'source',
        'source__markdown'
    ]
    assert doc['_text_'] == 'No headings with metadata'
    assert doc['cell_type'] == 'markdown'
    assert doc['id'] == 'NOTEBOOK_ID_1'
    assert doc['index'] == 1
    assert doc['notebook_filename'] == 'path/to/notebook'
    assert doc['notebook_id'] == 'NOTEBOOK_ID'
    assert doc['source'] == 'No headings with metadata'
    assert doc['source__markdown'] == 'No headings with metadata'
    assert doc['lc_cell_meme__current'] == 'CURRENT_METADATA_1'
    assert doc['lc_cell_meme__next'] == 'CURRENT_METADATA_2'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[2],
        2,
    )
    assert sorted(list(doc.keys())) == [
        '_text_', 'cell_type', 'id', 'index', 'lc_cell_meme__current',
        'lc_cell_meme__next', 'lc_cell_meme__previous', 'notebook_filename', 'notebook_id', 'source',
        'source__code'
    ]
    assert doc['_text_'] == '# Python Code'
    assert doc['cell_type'] == 'code'
    assert doc['id'] == 'NOTEBOOK_ID_2'
    assert doc['index'] == 2
    assert doc['notebook_filename'] == 'path/to/notebook'
    assert doc['notebook_id'] == 'NOTEBOOK_ID'
    assert doc['source'] == '# Python Code'
    assert doc['source__code'] == '# Python Code'
    assert doc['lc_cell_meme__current'] == 'CURRENT_METADATA_2'
    assert doc['lc_cell_meme__next'] == 'CURRENT_METADATA_3'
    assert doc['lc_cell_meme__previous'] == 'CURRENT_METADATA_1'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[3],
        3,
    )
    assert sorted(list(doc.keys())) == [
        '_text_', 'cell_type', 'id', 'index', 'lc_cell_meme__current',
        'lc_cell_meme__next', 'lc_cell_meme__previous', 'notebook_filename', 'notebook_id', 'source',
        'source__markdown'
    ]
    assert doc['_text_'] == 'Appendix for code'
    assert doc['cell_type'] == 'markdown'
    assert doc['id'] == 'NOTEBOOK_ID_3'
    assert doc['index'] == 3
    assert doc['notebook_filename'] == 'path/to/notebook'
    assert doc['notebook_id'] == 'NOTEBOOK_ID'
    assert doc['source__markdown'] == 'Appendix for code'
    assert doc['lc_cell_meme__current'] == 'CURRENT_METADATA_3'
    assert doc['lc_cell_meme__next'] == 'CURRENT_METADATA_4'
    assert doc['lc_cell_meme__previous'] == 'CURRENT_METADATA_2'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[0],
        0,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == ''
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == ''

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[1],
        1,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == ''
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == ''

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[2],
        2,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1'
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[3],
        3,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2'
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[4],
        4,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3'
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[5],
        5,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4'
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[6],
        6,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5'
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_7 CURRENT_METADATA_8'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_5'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[7],
        7,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_8 CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6'
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_8'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_5 CURRENT_METADATA_6'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[8],
        8,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_9 CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7'
    assert doc['lc_cell_memes__next__in_section'] == ''
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[9],
        9,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == 'CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8'
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_10'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[10],
        10,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_notebook'] == ''
    assert doc['lc_cell_memes__previous__in_notebook'] == 'CURRENT_METADATA_1 CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4 CURRENT_METADATA_5 CURRENT_METADATA_6 CURRENT_METADATA_7 CURRENT_METADATA_8 CURRENT_METADATA_9'
    assert doc['lc_cell_memes__next__in_section'] == ''
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_9'


def test_cell_to_solr_document_memes():
    cells = [
        {
            'cell_type': 'markdown',
            'source': ['# Section - 1\n', 'TestTest\n'],
            'metadata': {
                'lc_cell_meme': {
                    'current': 'CURRENT_METADATA_1',
                    'next': 'CURRENT_METADATA_2',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['## Subsection\n', 'TestTest\n'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_1',
                    'current': 'CURRENT_METADATA_2',
                    'next': 'CURRENT_METADATA_3',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Content (1-1)'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_2',
                    'current': 'CURRENT_METADATA_3',
                    'next': 'CURRENT_METADATA_4',
                },
            },
        },
        {
            'cell_type': 'markdown',
            'source': ['Content (1-2)'],
            'metadata': {
                'lc_cell_meme': {
                    'previous': 'CURRENT_METADATA_3',
                    'current': 'CURRENT_METADATA_4',
                    'next': 'CURRENT_METADATA_5',
                },
            },
        },
    ]

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[0],
        0,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_2 CURRENT_METADATA_3 CURRENT_METADATA_4'
    assert doc['lc_cell_memes__previous__in_section'] == ''

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[1],
        1,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_3 CURRENT_METADATA_4'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_1'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[2],
        2,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == 'CURRENT_METADATA_4'
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_2'

    doc = cell_to_solr_document(
        'NOTEBOOK_ID',
        'path/to/notebook',
        cells[3],
        3,
        cells=cells,
    )
    assert doc['lc_cell_memes__next__in_section'] == ''
    assert doc['lc_cell_memes__previous__in_section'] == 'CURRENT_METADATA_2 CURRENT_METADATA_3'
