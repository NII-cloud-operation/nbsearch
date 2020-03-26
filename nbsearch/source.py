from datetime import datetime
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

    def _get_files(self, actual_base_dir, db_base_dir):
        for name in os.listdir(actual_base_dir):
            actual_path = os.path.join(actual_base_dir, name)
            db_path = os.path.join(db_base_dir, name)
            if os.path.isdir(actual_path):
                for n in self._get_files(actual_path, db_path):
                    yield n
            elif os.path.isfile(actual_path) and name.lower().endswith('.ipynb'):
                stat = os.stat(actual_path)
                yield {'server': self.server, 'path': db_path, 'mtime': datetime.utcfromtimestamp(stat.st_mtime), 'atime': datetime.utcfromtimestamp(stat.st_atime)}
