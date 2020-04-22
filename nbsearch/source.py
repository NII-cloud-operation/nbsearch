from datetime import datetime
from fnmatch import fnmatch
import json
import os

from traitlets import Unicode
from traitlets.config import LoggingConfigurable


def get_source(name, config):
    if name == 'local':
        return LocalSource(config=config)
    else:
        raise KeyError('Unknown source: {}'.format(name))


class Source(LoggingConfigurable):

    def __init__(self, **kwargs):
        super(Source, self).__init__(**kwargs)

    def get_files(self):
        raise NotImplementedError()

    def get_notebook(self, server, path):
        raise NotImplementedError()

    def prepare(self):
        pass

    def close(self):
        pass


class LocalSource(Source):

    base_dir = Unicode('base_dir', help='base directory').tag(config=True)

    server = Unicode('server', help='My server address').tag(config=True)

    def __init__(self, **kwargs):
        super(LocalSource, self).__init__(**kwargs)

    def get_files(self):
        return self._get_files(self.base_dir, '')

    def get_notebook(self, server, path):
        if self.server != server:
            return None
        with open(os.path.join(self.base_dir, path), 'r') as f:
            return json.load(f)

    def _get_files(self, actual_base_dir, db_base_dir, check_ignore_base=None):
        ignore_file = os.path.join(actual_base_dir, '.nbsearchignore')
        _check_ignore = None
        if os.path.exists(ignore_file):
            with open(ignore_file, 'r') as f:
                ignore_patterns = [l.strip() for l in f.readlines()
                                   if not l.strip().startswith('#')]
            db_base_offset = 0 if len(db_base_dir) == 0 else len(db_base_dir) + 1
            _check_ignore = lambda path: any([fnmatch(path[db_base_offset:], p) or
                                              fnmatch(os.path.split(path)[-1], p)
                                              for p in ignore_patterns])
        check_ignore = _check_ignore
        if check_ignore_base is not None:
            if _check_ignore is not None:
                check_ignore = lambda path: check_ignore_base(path) or _check_ignore(path)
            else:
                check_ignore = check_ignore_base
        for name in os.listdir(actual_base_dir):
            if name.startswith('.'):
                continue
            actual_path = os.path.join(actual_base_dir, name)
            db_path = os.path.join(db_base_dir, name)
            if check_ignore is not None and check_ignore(db_path):
                continue
            if os.path.isdir(actual_path):
                for n in self._get_files(actual_path, db_path, check_ignore):
                    yield n
            elif os.path.isfile(actual_path) and name.lower().endswith('.ipynb'):
                stat = os.stat(actual_path)
                yield {'server': self.server, 'path': db_path, 'mtime': datetime.utcfromtimestamp(stat.st_mtime), 'atime': datetime.utcfromtimestamp(stat.st_atime)}
