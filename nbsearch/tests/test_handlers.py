import io
import json
from urllib.parse import quote
import os
from stat import S_IREAD
import shutil
import tempfile
import unittest
import tornado.testing
import tornado.web
from unittest import mock
import nbsearch.server
from nbsearch.v1.handlers import SearchHandler, ImportHandler, DataHandler

collection_name = 'test_notebooks'
history_name = 'test_history'


# Test handlers without authentication
class TestableSearchHandler(SearchHandler):
    def get_current_user(self):
        return "test_user"


class TestableImportHandler(ImportHandler):
    def get_current_user(self):
        return "test_user"


class TestableDataHandler(DataHandler):
    def get_current_user(self):
        return "test_user"


class ApiHandlerTestCaseBase(tornado.testing.AsyncHTTPTestCase):

    def setUp(self):
        self.base_dir = tempfile.mkdtemp()
        self.nbsearchdb_patcher = mock.patch.object(
            nbsearch.server,
            'NBSearchDB',
        )
        self.mock_nbsearchdb = self.nbsearchdb_patcher.start()
        super().setUp()

    def tearDown(self):
        shutil.rmtree(self.base_dir)
        self.nbsearchdb_patcher.stop()
        super().tearDown()

    def get_app(self):
        handler_settings = {}
        handler_settings['db'] = self.mock_nbsearchdb()
        handler_settings['base_dir'] = self.base_dir

        handlers = [
            (r"/v1/(?P<target>[^\/]+)/search", TestableSearchHandler, handler_settings),
            (r"/v1/import(?P<path>/.+)?/(?P<id>[^\/]+)", TestableImportHandler, handler_settings),
            (r"/v1/data/(?P<id>[^\/]+)", TestableDataHandler, handler_settings),
        ]

        return tornado.web.Application(
            handlers,
            cookie_secret="test_secret_for_testing"
        )


class TestSearchHandler(ApiHandlerTestCaseBase):

    def test_missing_query(self):
        response = self.fetch('/v1/cell/search')
        self.assertEqual(response.code, 400)

    def test_basic_cell_search(self):
        dummy_doc = {
            'test': True,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=('_text_:*', result))
        self.mock_nbsearchdb().query.side_effect = mock_query
        response = self.fetch('/v1/cell/search?query=' + quote('_text_:*'))
        self.assertEqual(response.code, 200)
        self.assertEqual(response.headers['Content-Type'],
                         'application/json')
        self.assertEqual(json.loads(response.body.decode('utf8')), {
            'cells': [{'test': True}],
            'error': None,
            'limit': 50,
            'numFound': 1,
            'size': 1,
            'solrquery': '_text_:*',
            'sort': None,
            'start': 0,
        })
        self.assertEqual(mock_query.call_count, 1)
        self.assertEqual(mock_query.call_args[0][0], 'jupyter-cell')
        self.assertEqual(mock_query.call_args[0][1], '_text_:*')

    def test_basic_notebook_search(self):
        dummy_doc = {
            'test': True,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=('_text_:*', result))
        self.mock_nbsearchdb().query.side_effect = mock_query
        response = self.fetch('/v1/notebook/search?query=' + quote('_text_:*'))
        self.assertEqual(response.code, 200)
        self.assertEqual(response.headers['Content-Type'],
                         'application/json')
        self.assertEqual(json.loads(response.body.decode('utf8')), {
            'notebooks': [{'test': True}],
            'error': None,
            'limit': 50,
            'numFound': 1,
            'size': 1,
            'solrquery': '_text_:*',
            'sort': None,
            'start': 0,
        })
        self.assertEqual(mock_query.call_count, 1)
        self.assertEqual(mock_query.call_args[0][0], 'jupyter-notebook')
        self.assertEqual(mock_query.call_args[0][1], '_text_:*')


class TestImportHandler(ApiHandlerTestCaseBase):

    def setUp(self):
        super().setUp()
        self.notebook_file_id = '0123456789ab0123456789ab'
        self.notebook_filename = 'notebook1.ipynb'

    @mock.patch('nbsearch.v1.handlers.os.chmod')
    def test_import(self, mock_chmod):
        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=(None, result))
        mock_download_file = mock.AsyncMock()
        self.mock_nbsearchdb().query.side_effect = mock_query
        self.mock_nbsearchdb().download_file.side_effect = mock_download_file

        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.mkdir(dest_full_path)

        response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
        self.assertEqual(response.code, 200)

        self.assertEqual(mock_query.call_count, 1)
        self.assertEqual(mock_query.call_args[0][0], 'jupyter-notebook')
        self.assertEqual(mock_query.call_args[0][1], 'id:"0123456789ab0123456789ab"')
        self.assertEqual(mock_download_file.call_count, 1)
        self.assertEqual(mock_download_file.call_args[0][0], self.notebook_file_id)
        self.assertIsInstance(mock_download_file.call_args[0][1], io.BufferedIOBase)
        self.assertEqual(mock_download_file.call_args[0][1].name,
                         os.path.join(dest_full_path, self.notebook_filename))
        mock_chmod.assert_not_called()

    @mock.patch('nbsearch.v1.handlers.os.chmod')
    def test_import_read_only(self, mock_chmod):
        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=(None, result))
        mock_download_file = mock.AsyncMock()
        self.mock_nbsearchdb().query.side_effect = mock_query
        self.mock_nbsearchdb().download_file.side_effect = mock_download_file

        dest_path = 'nbsearch-tmp'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.mkdir(dest_full_path)

        response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
        self.assertEqual(response.code, 200)

        self.assertEqual(mock_query.call_count, 1)
        self.assertEqual(mock_query.call_args[0][0], 'jupyter-notebook')
        self.assertEqual(mock_query.call_args[0][1], 'id:"0123456789ab0123456789ab"')
        self.assertEqual(mock_download_file.call_count, 1)
        self.assertEqual(mock_download_file.call_args[0][0], self.notebook_file_id)
        self.assertIsInstance(mock_download_file.call_args[0][1], io.BufferedIOBase)
        self.assertEqual(mock_download_file.call_args[0][1].name,
                         os.path.join(dest_full_path, self.notebook_filename))
        mock_chmod.assert_called_once()
        self.assertTrue(mock_chmod.call_args[0][0].endswith('/' + self.notebook_filename))
        self.assertEqual(mock_chmod.call_args[0][1], S_IREAD)

    def test_import_multiple(self):
        dest_notebook_filenames = [
            'notebook1.ipynb',
            'notebook1 (1).ipynb',
            'notebook1 (2).ipynb',
        ]
        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.mkdir(dest_full_path)

        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        for dest_notebook_filename in dest_notebook_filenames:
            mock_query = mock.AsyncMock(return_value=(None, result))
            mock_download_file = mock.AsyncMock()
            self.mock_nbsearchdb().query.side_effect = mock_query
            self.mock_nbsearchdb().download_file.side_effect = mock_download_file

            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 200)

            self.assertEqual(mock_query.call_count, 1)
            self.assertEqual(mock_query.call_args[0][0], 'jupyter-notebook')
            self.assertEqual(mock_query.call_args[0][1], 'id:"0123456789ab0123456789ab"')
            self.assertEqual(mock_download_file.call_count, 1)
            self.assertEqual(mock_download_file.call_args[0][1].name,
                             os.path.join(dest_full_path, dest_notebook_filename))

    def test_import_to_nested_path(self):
        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=(None, result))
        mock_download_file = mock.AsyncMock()
        self.mock_nbsearchdb().query.side_effect = mock_query
        self.mock_nbsearchdb().download_file.side_effect = mock_download_file

        dest_path = 'dest/a/b/c'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.makedirs(dest_full_path, exist_ok=True)

        response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
        self.assertEqual(response.code, 200)

        self.assertEqual(mock_download_file.call_count, 1)
        self.assertEqual(mock_download_file.call_args[0][0], self.notebook_file_id)
        self.assertIsInstance(mock_download_file.call_args[0][1], io.BufferedIOBase)
        self.assertEqual(mock_download_file.call_args[0][1].name,
                         os.path.join(dest_full_path, self.notebook_filename))

    def test_import_multiple_to_nested_path(self):
        dest_notebook_filenames = [
            'notebook1.ipynb',
            'notebook1 (1).ipynb',
            'notebook1 (2).ipynb',
        ]
        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.makedirs(dest_full_path, exist_ok=True)

        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        for dest_notebook_filename in dest_notebook_filenames:
            mock_query = mock.AsyncMock(return_value=(None, result))
            mock_download_file = mock.AsyncMock()
            self.mock_nbsearchdb().query.side_effect = mock_query
            self.mock_nbsearchdb().download_file.side_effect = mock_download_file

            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 200)

            self.assertEqual(mock_query.call_count, 1)
            self.assertEqual(mock_query.call_args[0][0], 'jupyter-notebook')
            self.assertEqual(mock_query.call_args[0][1], 'id:"0123456789ab0123456789ab"')
            self.assertEqual(mock_download_file.call_count, 1)
            self.assertEqual(mock_download_file.call_args[0][1].name,
                             os.path.join(dest_full_path, dest_notebook_filename))

    def test_import_to_empty_path(self):
        response = self.fetch('/v1/import/{}/{}'.format('', self.notebook_file_id))
        self.assertEqual(response.code, 404)

    def test_import_to_including_dot_path(self):
        dest_paths = [
            '..', '../x', 'x/..', 'x/../y',
            '.', './x', 'x/.', 'x/./y',
        ]

        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        for dest_path in dest_paths:
            mock_query = mock.AsyncMock(return_value=(None, result))
            mock_download_file = mock.AsyncMock()
            self.mock_nbsearchdb().query.side_effect = mock_query
            self.mock_nbsearchdb().download_file.side_effect = mock_download_file

            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 400)
            self.assertEqual(mock_query.call_count, 1)
            self.assertEqual(mock_download_file.call_count, 0)

    def test_import_to_start_with_multiple_slashed_path(self):
        dest_paths = [
            '//x', '///x',
        ]

        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [
                    dummy_doc,
                ],
                'numFound': 1,
                'start': 0,
            },
        }
        for dest_path in dest_paths:
            mock_query = mock.AsyncMock(return_value=(None, result))
            mock_download_file = mock.AsyncMock()
            self.mock_nbsearchdb().query.side_effect = mock_query
            self.mock_nbsearchdb().download_file.side_effect = mock_download_file

            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 400)
            self.assertEqual(mock_query.call_count, 1)
            self.assertEqual(mock_download_file.call_count, 0)


class TestDataHandler(ApiHandlerTestCaseBase):

    def setUp(self):
        super().setUp()
        self.notebook_file_id = '0123456789ab0123456789ab'
        self.notebook_filename = '/path/to/test_notebook.ipynb'

    def test_data_basic(self):
        # Sample notebook data
        notebook_data = {
            "cells": [
                {
                    "cell_type": "code",
                    "source": ["print('hello world')"],
                    "execution_count": 1,
                    "outputs": []
                }
            ],
            "metadata": {},
            "nbformat": 4,
            "nbformat_minor": 4
        }
        notebook_json = json.dumps(notebook_data)

        dummy_doc = {
            'filename': self.notebook_filename,
            'owner': 'test_user',
            'signature_server_url': 'http://test.server',
            'mtime': '2023-01-01T00:00:00Z'
        }
        result = {
            'response': {
                'docs': [dummy_doc],
                'numFound': 1,
                'start': 0,
            },
        }

        # Mock the query and download_file methods
        mock_query = mock.AsyncMock(return_value=(None, result))

        def mock_download_file(file_id, file_obj):
            file_obj.write(notebook_json.encode('utf-8'))
            return mock.AsyncMock()

        mock_download = mock.AsyncMock(side_effect=mock_download_file)
        self.mock_nbsearchdb().query = mock_query
        self.mock_nbsearchdb().download_file = mock_download

        response = self.fetch(f'/v1/data/{self.notebook_file_id}')
        self.assertEqual(response.code, 200)

        response_data = json.loads(response.body.decode())
        self.assertIn('notebook', response_data)
        self.assertIn('metadata', response_data)

        # Check notebook content
        self.assertEqual(response_data['notebook'], notebook_data)

        # Check metadata
        metadata = response_data['metadata']
        self.assertEqual(metadata['id'], self.notebook_file_id)
        self.assertEqual(metadata['filename'], 'test_notebook.ipynb')
        self.assertEqual(metadata['original_path'], self.notebook_filename)
        self.assertEqual(metadata['owner'], 'test_user')
        self.assertEqual(metadata['server'], 'http://test.server')
        self.assertEqual(metadata['modified'], '2023-01-01T00:00:00Z')

    def test_data_not_found(self):
        result = {
            'response': {
                'docs': [],
                'numFound': 0,
                'start': 0,
            },
        }
        mock_query = mock.AsyncMock(return_value=(None, result))
        self.mock_nbsearchdb().query = mock_query

        response = self.fetch(f'/v1/data/{self.notebook_file_id}')
        self.assertEqual(response.code, 404)

    def test_data_invalid_json(self):
        dummy_doc = {
            'filename': self.notebook_filename,
        }
        result = {
            'response': {
                'docs': [dummy_doc],
                'numFound': 1,
                'start': 0,
            },
        }

        mock_query = mock.AsyncMock(return_value=(None, result))

        def mock_download_file(file_id, file_obj):
            file_obj.write(b'invalid json content')
            return mock.AsyncMock()

        mock_download = mock.AsyncMock(side_effect=mock_download_file)
        self.mock_nbsearchdb().query = mock_query
        self.mock_nbsearchdb().download_file = mock_download

        response = self.fetch(f'/v1/data/{self.notebook_file_id}')
        self.assertEqual(response.code, 400)


if __name__ == '__main__':
    unittest.main()
