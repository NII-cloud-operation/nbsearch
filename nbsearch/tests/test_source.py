from datetime import datetime, timedelta
import json
import os
import tempfile
import time

from nbsearch.source import LocalSource


def test_get_files():
    with tempfile.TemporaryDirectory() as tempdirname:
        source = LocalSource()
        source.server = 'http://test/server'
        source.base_dir = tempdirname

        assert list(source.get_files()) == []

        current_time = datetime.utcnow()
        time.sleep(3)
        with open(os.path.join(tempdirname, 'test.ipynb'), 'w') as f:
            f.write(json.dumps({}))

        files = list(source.get_files())
        assert len(files) == 1
        assert files[0]['path'] == 'test.ipynb'
        assert files[0]['mtime'] >= current_time
        assert files[0]['atime'] >= current_time
        assert files[0]['mtime'] < current_time + timedelta(hours=1)
        assert files[0]['atime'] < current_time + timedelta(hours=1)

        with open(os.path.join(tempdirname, 'test.dat'), 'w') as f:
            f.write(json.dumps({}))

        files = list(source.get_files())
        assert len(files) == 1
        assert files[0]['path'] == 'test.ipynb'
        assert files[0]['mtime'] >= current_time
        assert files[0]['atime'] >= current_time
        assert files[0]['mtime'] < current_time + timedelta(hours=1)
        assert files[0]['atime'] < current_time + timedelta(hours=1)

        os.mkdir(os.path.join(tempdirname, 'test1'))
        with open(os.path.join(tempdirname, 'test1', 'test1sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2
        assert files[0]['path'] == 'test.ipynb'
        assert files[0]['mtime'] >= current_time
        assert files[0]['atime'] >= current_time
        assert files[0]['mtime'] < current_time + timedelta(hours=1)
        assert files[0]['atime'] < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert files[1]['mtime'] >= current_time
        assert files[1]['atime'] >= current_time
        assert files[1]['mtime'] < current_time + timedelta(hours=1)
        assert files[1]['atime'] < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test1/test1sub.ipynb') == {}
