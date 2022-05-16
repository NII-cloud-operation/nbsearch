from datetime import datetime, timedelta
import json
import os
import tempfile
import time
import pytz

from nbsearch.source import LocalSource


def _fromisoformat(dt):
    if dt.endswith('Z'):
        dt = dt[:-1] + '+00:00'
    return datetime.fromisoformat(dt).astimezone(pytz.utc)

def test_get_files():
    with tempfile.TemporaryDirectory() as tempdirname:
        source = LocalSource()
        source.server = 'http://test/server'
        source.base_dir = tempdirname

        assert list(source.get_files()) == []

        current_time = datetime.now(pytz.utc)
        time.sleep(3)
        with open(os.path.join(tempdirname, 'test.ipynb'), 'w') as f:
            f.write(json.dumps({}))

        files = list(source.get_files())
        assert len(files) == 1
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time, (files[0]['mtime'], current_time)
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)

        with open(os.path.join(tempdirname, 'test.dat'), 'w') as f:
            f.write(json.dumps({}))

        files = list(source.get_files())
        assert len(files) == 1
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)

        os.mkdir(os.path.join(tempdirname, 'test1'))
        with open(os.path.join(tempdirname, 'test1', 'test1sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert _fromisoformat(files[1]['mtime']) >= current_time
        assert _fromisoformat(files[1]['atime']) >= current_time
        assert _fromisoformat(files[1]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[1]['atime']) < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test1/test1sub.ipynb') == {}

def test_get_files_with_nbsearchignore():
    with tempfile.TemporaryDirectory() as tempdirname:
        source = LocalSource()
        source.server = 'http://test/server'
        source.base_dir = tempdirname

        assert list(source.get_files()) == []

        current_time = datetime.now(pytz.utc)
        time.sleep(3)
        with open(os.path.join(tempdirname, 'test.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, 'test.dat'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test1'))
        with open(os.path.join(tempdirname, 'test1', 'test1sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test2'))
        with open(os.path.join(tempdirname, 'test2', 'test2sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, '.nbsearchignore'), 'w') as f:
            f.write('''
# test1/**
test2/**
''')

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert _fromisoformat(files[1]['mtime']) >= current_time
        assert _fromisoformat(files[1]['atime']) >= current_time
        assert _fromisoformat(files[1]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[1]['atime']) < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test1/test1sub.ipynb') == {}

def test_get_files_with_nbsearchignore():
    with tempfile.TemporaryDirectory() as tempdirname:
        source = LocalSource()
        source.server = 'http://test/server'
        source.base_dir = tempdirname

        assert list(source.get_files()) == []

        current_time = datetime.now(pytz.utc)
        time.sleep(3)
        with open(os.path.join(tempdirname, 'test.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, 'test.dat'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test1'))
        with open(os.path.join(tempdirname, 'test1', 'test1sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test2'))
        with open(os.path.join(tempdirname, 'test2', 'test2sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, '.nbsearchignore'), 'w') as f:
            f.write('''
# test1/**
test2/**
''')

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert _fromisoformat(files[1]['mtime']) >= current_time
        assert _fromisoformat(files[1]['atime']) >= current_time
        assert _fromisoformat(files[1]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[1]['atime']) < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test2/test2sub.ipynb') == {}

        with open(os.path.join(tempdirname, 'test1', 'ignore.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, '.nbsearchignore'), 'w') as f:
            f.write('''
# test1/**
test2/**
ignore.ipynb
''')

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert _fromisoformat(files[1]['mtime']) >= current_time
        assert _fromisoformat(files[1]['atime']) >= current_time
        assert _fromisoformat(files[1]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[1]['atime']) < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test2/test2sub.ipynb') == {}

def test_get_files_with_nbsearchignores():
    with tempfile.TemporaryDirectory() as tempdirname:
        source = LocalSource()
        source.server = 'http://test/server'
        source.base_dir = tempdirname

        assert list(source.get_files()) == []

        current_time = datetime.now(pytz.utc)
        time.sleep(3)
        with open(os.path.join(tempdirname, 'test.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, 'test.dat'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test1'))
        with open(os.path.join(tempdirname, 'test1', 'test1sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, 'test1', 'ignore.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        os.mkdir(os.path.join(tempdirname, 'test2'))
        with open(os.path.join(tempdirname, 'test2', 'test2sub.ipynb'), 'w') as f:
            f.write(json.dumps({}))
        with open(os.path.join(tempdirname, '.nbsearchignore'), 'w') as f:
            f.write('''
# test1/**
test2/**
''')
        with open(os.path.join(tempdirname, 'test1', '.nbsearchignore'), 'w') as f:
            f.write('''
 ignore.ipynb
''')

        files = sorted(source.get_files(), key=lambda x: x['path'])
        assert len(files) == 2, [f['path'] for f in files]
        assert files[0]['path'] == 'test.ipynb'
        assert _fromisoformat(files[0]['mtime']) >= current_time
        assert _fromisoformat(files[0]['atime']) >= current_time
        assert _fromisoformat(files[0]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[0]['atime']) < current_time + timedelta(hours=1)
        assert files[1]['path'] == 'test1/test1sub.ipynb'
        assert _fromisoformat(files[1]['mtime']) >= current_time
        assert _fromisoformat(files[1]['atime']) >= current_time
        assert _fromisoformat(files[1]['mtime']) < current_time + timedelta(hours=1)
        assert _fromisoformat(files[1]['atime']) < current_time + timedelta(hours=1)

        assert source.get_notebook('http://test/server', 'test1/ignore.ipynb') == {}
