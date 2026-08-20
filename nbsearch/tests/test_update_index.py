import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from traitlets.config import Config

from nbsearch.db import UpdateIndexHandler
from nbsearch.extensionapp import UpdateIndexApp
from nbsearch.source import LocalSource


class UpdateIndexDryRunTestCase(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)

        self.source = LocalSource()
        self.source.base_dir = str(self.root)
        self.source.server = 'http://test.invalid/'
        self.source.owner = ''
        self.source.owner_pattern = ''
        self.source.get_notebook = mock.Mock(
            side_effect=AssertionError('dry-run must not read notebook bodies')
        )

        self.db = mock.Mock()
        self.db.post_document = mock.AsyncMock()
        self.db.upload_file = mock.AsyncMock()
        self.db._ensure_bucket = mock.AsyncMock()

        self.handler = UpdateIndexHandler(config=Config())

        self.config_loader_patcher = mock.patch('nbsearch.db.PyFileConfigLoader')
        self.config_loader = self.config_loader_patcher.start()
        self.config_loader.return_value.load_config.return_value = Config()

        self.db_patcher = mock.patch('nbsearch.db.NBSearchDB', return_value=self.db)
        self.db_class = self.db_patcher.start()

        self.source_patcher = mock.patch('nbsearch.db.get_source', return_value=self.source)
        self.get_source = self.source_patcher.start()

        self.solr_client_patcher = mock.patch('nbsearch.db.AsyncHTTPClient')
        self.solr_client = self.solr_client_patcher.start()

        self.s3_client_patcher = mock.patch('nbsearch.db.aioboto3.Session')
        self.s3_client = self.s3_client_patcher.start()

    def tearDown(self):
        self.s3_client_patcher.stop()
        self.solr_client_patcher.stop()
        self.source_patcher.stop()
        self.db_patcher.stop()
        self.config_loader_patcher.stop()
        self.tempdir.cleanup()

    def write_notebook(self, relative_path):
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({}), encoding='utf-8')

    async def run_dry_run(self, path=None):
        output = io.StringIO()
        with redirect_stdout(output):
            await self.handler.update('config.py', 'local', path, dry_run=True)
        return output.getvalue()

    def assert_no_persistent_writes(self):
        self.source.get_notebook.assert_not_called()
        self.db.post_document.assert_not_awaited()
        self.db.upload_file.assert_not_awaited()
        self.db._ensure_bucket.assert_not_awaited()
        self.solr_client.assert_not_called()
        self.s3_client.assert_not_called()

    async def test_dry_run_outputs_nested_notebooks_in_sorted_order(self):
        self.write_notebook('z.ipynb')
        self.write_notebook('nested/m.ipynb')
        self.write_notebook('a.ipynb')

        output = await self.run_dry_run()

        self.assertEqual(output, 'a.ipynb\nnested/m.ipynb\nz.ipynb\n')
        self.assert_no_persistent_writes()

    async def test_dry_run_sorts_independently_of_source_order(self):
        self.source.get_files = mock.Mock(return_value=[
            {'server': self.source.server, 'path': 'z.ipynb'},
            {'server': self.source.server, 'path': 'nested/m.ipynb'},
            {'server': self.source.server, 'path': 'a.ipynb'},
        ])

        output = await self.run_dry_run()

        self.assertEqual(output, 'a.ipynb\nnested/m.ipynb\nz.ipynb\n')
        self.assert_no_persistent_writes()

    async def test_dry_run_honors_ignore_hidden_and_extension_filters(self):
        self.write_notebook('visible.ipynb')
        self.write_notebook('ignored.ipynb')
        self.write_notebook('nested/ignored-too.ipynb')
        self.write_notebook('.hidden.ipynb')
        self.write_notebook('.hidden-dir/secret.ipynb')
        (self.root / 'notes.txt').write_text('not a notebook', encoding='utf-8')
        (self.root / '.nbsearchignore').write_text(
            'ignored.ipynb\nnested/ignored-too.ipynb\n', encoding='utf-8'
        )

        output = await self.run_dry_run()

        self.assertEqual(output, 'visible.ipynb\n')
        self.assert_no_persistent_writes()

    async def test_dry_run_preserves_explicit_path_basename_matching(self):
        self.write_notebook('one/target.ipynb')
        self.write_notebook('two/target.ipynb')
        self.write_notebook('two/other.ipynb')

        output = await self.run_dry_run('provided/path/target.ipynb')

        self.assertEqual(output, 'one/target.ipynb\ntwo/target.ipynb\n')
        self.assert_no_persistent_writes()

    async def test_dry_run_with_zero_selected_notebooks_is_silent(self):
        self.write_notebook('present.ipynb')

        output = await self.run_dry_run('missing.ipynb')

        self.assertEqual(output, '')
        self.assert_no_persistent_writes()

    async def test_normal_mode_reaches_existing_write_path(self):
        notebook = {'cells': [], 'metadata': {}, 'nbformat': 4, 'nbformat_minor': 5}
        file_info = {
            'server': self.source.server,
            'path': 'normal.ipynb',
            'owner': None,
            'mtime': '2026-01-01T00:00:00Z',
            'ctime': '2026-01-01T00:00:00Z',
            'atime': '2026-01-01T00:00:00Z',
        }
        self.source.get_files = mock.Mock(return_value=[file_info])
        self.source.get_notebook = mock.Mock(return_value=notebook)
        documents = {
            'jupyter-notebook': [{'id': 'notebook-id'}],
            'jupyter-cell': [{'id': 'cell-id'}],
        }

        with mock.patch('nbsearch.db.solr.ipynb_to_documents', return_value=documents) as convert:
            await self.handler.update('config.py', 'local', None, dry_run=False)

        self.source.get_notebook.assert_called_once_with(
            self.source.server, 'normal.ipynb'
        )
        convert.assert_called_once()
        self.assertEqual(self.db.post_document.await_count, 2)
        self.db.upload_file.assert_awaited_once_with('notebook-id', notebook)


class UpdateIndexCliTestCase(unittest.TestCase):

    def run_app(self, argv):
        app = UpdateIndexApp()
        app.initialize(argv)
        app.handler.update = mock.AsyncMock()
        app.start()
        return app

    def test_dry_run_flag_enables_dry_run(self):
        app = self.run_app(['--dry-run', 'config.py', 'local'])

        self.assertTrue(app.dry_run)
        app.handler.update.assert_awaited_once_with(
            'config.py', 'local', None, dry_run=True
        )

    def test_absent_dry_run_flag_preserves_normal_mode(self):
        app = self.run_app(['config.py', 'local'])

        self.assertFalse(app.dry_run)
        app.handler.update.assert_awaited_once_with(
            'config.py', 'local', None, dry_run=False
        )
