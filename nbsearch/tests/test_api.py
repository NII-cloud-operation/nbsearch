import io
import shutil
import tempfile
import unittest
import tornado.testing
import tornado.web
import motor.motor_tornado
import mock
import nbsearch.server
import os
from .utils import AsyncMock

collection_name = 'test_notebooks'


class ApiHandlerTestCaseBase(tornado.testing.AsyncHTTPTestCase):

    def setUp(self):
        self.db = mock.Mock()
        self.collection = mock.Mock()
        self.base_dir = tempfile.mkdtemp()
        self.handler_settings = {
            'database': self.db,
            'collection': self.collection,
            'base_dir': self.base_dir,
        }
        super().setUp()

    def tearDown(self):
        shutil.rmtree(self.base_dir)
        super().tearDown()

    def get_app(self):
        return tornado.web.Application(
            nbsearch.server.get_api_handlers(self.handler_settings)
        )


class TestDownloadHandler(ApiHandlerTestCaseBase):

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_download(self, mock_fs_init):
        notebook_file_id = '0123456789ab0123456789ab'
        notebook_filename = 'notebook1.ipynb'
        notebook = {'path': os.path.join(self.base_dir, notebook_filename)}

        mock_fs = mock.Mock()
        mock_fs.download_to_stream = AsyncMock()
        mock_fs_init.return_value = mock_fs
        self.collection.find_one = AsyncMock()
        self.collection.find_one.return_value = notebook

        response = self.fetch('/v1/download/{}'.format(notebook_file_id))
        self.assertEqual(response.code, 200)
        self.assertIn('Content-Disposition', response.headers)
        self.assertEqual(response.headers['Content-Disposition'],
                         'attachment; filename="{}"'.format(notebook_filename))
        self.assertIn('Content-Type', response.headers)
        self.assertEqual(response.headers['Content-Type'],
                         'application/json; charset=utf-8')

        self.assertEqual(mock_fs.download_to_stream.call_count, 1)
        self.assertEqual(str(mock_fs.download_to_stream.call_args[0][0]), notebook_file_id)


class TestImportHandler(ApiHandlerTestCaseBase):

    def setUp(self):
        super().setUp()
        self.notebook_file_id = '0123456789ab0123456789ab'
        self.notebook_filename = 'notebook1.ipynb'
        self.notebook = {'path': os.path.join(self.base_dir, self.notebook_filename)}
        self.collection.find_one = AsyncMock()
        self.collection.find_one.return_value = self.notebook

    def tearDown(self):
        super().tearDown()

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import(self, mock_fs_init):
        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.mkdir(dest_full_path)

        mock_fs = mock.Mock()
        mock_fs.download_to_stream = AsyncMock()
        mock_fs_init.return_value = mock_fs

        response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
        self.assertEqual(response.code, 200)

        self.assertEqual(mock_fs.download_to_stream.call_count, 1)
        self.assertEqual(str(mock_fs.download_to_stream.call_args[0][0]), self.notebook_file_id)
        self.assertIsInstance(mock_fs.download_to_stream.call_args[0][1], io.BufferedIOBase)
        self.assertEqual(mock_fs.download_to_stream.call_args[0][1].name,
                         os.path.join(dest_full_path, self.notebook_filename))

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_multiple(self, mock_fs_init):
        dest_notebook_filenames = [
            'notebook1.ipynb',
            'notebook1 (1).ipynb',
            'notebook1 (2).ipynb',
        ]
        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.mkdir(dest_full_path)

        mock_fs = mock.Mock()
        mock_fs_init.return_value = mock_fs

        for dest_notebook_filename in dest_notebook_filenames:
            mock_fs.download_to_stream = AsyncMock()
            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 200)
            self.assertEqual(mock_fs.download_to_stream.call_count, 1)
            self.assertEqual(mock_fs.download_to_stream.call_args[0][1].name,
                             os.path.join(dest_full_path, dest_notebook_filename))

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_to_nested_path(self, mock_fs_init):
        dest_path = 'dest/a/b/c'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.makedirs(dest_full_path, exist_ok=True)

        mock_fs = mock.Mock()
        mock_fs.download_to_stream = AsyncMock()
        mock_fs_init.return_value = mock_fs

        response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
        self.assertEqual(response.code, 200)

        self.assertEqual(mock_fs.download_to_stream.call_count, 1)
        self.assertEqual(str(mock_fs.download_to_stream.call_args[0][0]), self.notebook_file_id)
        self.assertEqual(mock_fs.download_to_stream.call_args[0][1].name,
                         os.path.join(dest_full_path, self.notebook_filename))

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_multiple_to_nested_path(self, mock_fs_init):
        dest_notebook_filenames = [
            'notebook1.ipynb',
            'notebook1 (1).ipynb',
            'notebook1 (2).ipynb',
        ]
        dest_path = 'dest'
        dest_full_path = os.path.join(self.base_dir, dest_path)
        os.makedirs(dest_full_path, exist_ok=True)

        mock_fs = mock.Mock()
        mock_fs_init.return_value = mock_fs

        for dest_notebook_filename in dest_notebook_filenames:
            mock_fs.download_to_stream = AsyncMock()
            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 200)
            self.assertEqual(mock_fs.download_to_stream.call_count, 1)
            self.assertEqual(mock_fs.download_to_stream.call_args[0][1].name,
                             os.path.join(dest_full_path, dest_notebook_filename))

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_to_empty_path(self, mock_fs_init):
        mock_fs = mock.Mock()
        mock_fs.download_to_stream = AsyncMock()
        mock_fs_init.return_value = mock_fs

        response = self.fetch('/v1/import/{}/{}'.format('', self.notebook_file_id))
        self.assertEqual(response.code, 404)

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_to_including_dot_path(self, mock_fs_init):
        mock_fs = mock.Mock()
        mock_fs_init.return_value = mock_fs
        dest_paths = [
            '..', '../x', 'x/..', 'x/../y',
            '.', './x', 'x/.', 'x/./y',
        ]

        for dest_path in dest_paths:
            mock_fs.download_to_stream = AsyncMock()
            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 400)
            self.assertEqual(mock_fs.download_to_stream.call_count, 0)

    @mock.patch.object(motor.motor_tornado, 'MotorGridFSBucket')
    def test_import_to_start_with_multiple_slashed_path(self, mock_fs_init):
        mock_fs = mock.Mock()
        mock_fs_init.return_value = mock_fs
        dest_paths = [
            '//x', '///x',
        ]

        for dest_path in dest_paths:
            mock_fs.download_to_stream = AsyncMock()
            response = self.fetch('/v1/import/{}/{}'.format(dest_path, self.notebook_file_id))
            self.assertEqual(response.code, 400)
            self.assertEqual(mock_fs.download_to_stream.call_count, 0)


if __name__ == '__main__':
    unittest.main()
