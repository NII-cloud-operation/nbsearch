import json
import os
import re

import motor.motor_tornado
import pymongo
from gridfs import GridFS

from traitlets import Unicode, Int
from traitlets.config.configurable import Configurable
from traitlets.config import LoggingConfigurable
from traitlets.config.loader import PyFileConfigLoader

from .source import get_source


class NBSearchDB(Configurable):

    hostname = Unicode('localhost', help='The hostname of MongoDB').tag(config=True)

    port = Int(27017, help='The port of MongoDB').tag(config=True)

    username = Unicode(help='The username of authenticated user').tag(config=True)

    password = Unicode(help='The password of authenticated user').tag(config=True)

    database = Unicode('nbsearch', help='The database on MongoDB').tag(config=True)

    collection = Unicode('notebooks', help='The collection of notebooks').tag(config=True)

    history = Unicode('history', help='The collection of history').tag(config=True)

    def get_async_database(self):
        if self.username or self.password:
            client = motor.motor_tornado.MotorClient(self.hostname, self.port,
                                                     username=self.username,
                                                     password=self.password)
        else:
            client = motor.motor_tornado.MotorClient(self.hostname, self.port)
        return client[self.database]

    def get_database(self):
        if self.username or self.password:
            client = pymongo.MongoClient(self.hostname, self.port,
                                         username=self.username,
                                         password=self.password)
        else:
            client = pymongo.MongoClient(self.hostname, self.port)
        return client[self.database]


class UpdateIndexHandler(LoggingConfigurable):

    def __init__(self, **kwargs):
        super(UpdateIndexHandler, self).__init__(**kwargs)

    def update(self, cpath, source, path):
        self.log.info('update_index for {}, {}({})'.format(source, path, cpath))
        self.config.merge(PyFileConfigLoader(cpath).load_config())
        db = NBSearchDB(config=self.config)
        gfs = GridFS(db.get_database())
        collection = db.get_database()[db.collection]
        source = get_source(source, self.config)

        updated = 0
        for file in source.get_files():
            if path is not None and os.path.split(file['path'])[-1] != os.path.split(path)[-1]:
                continue
            self.log.info('FILE {}'.format(file))
            self.update_notebook(source, file, collection, gfs)
            updated += 1
        if updated == 0:
            return
        self.log.info('updating indices...')
        collection.create_index([('cells.outputs.text', 'text'), ('cells.source', 'text')])
        for field in [
            'atime', 'mtime', 'path', 'server',
            'cells.metadata.lc_cell_meme.current',
            'cells.metadata.lc_cell_meme.previous',
            'cells.metadata.lc_cell_meme.next',
        ]:
            collection.create_index([(field, 1)])
        self.log.info('finished')

    def update_notebook(self, source, file, collection, gfs):
        content = source.get_notebook(file['server'], file['path'])
        notebook = self.normalize_notebook(content)
        server_meme = None
        if 'metadata' in notebook and 'lc_notebook_meme' in notebook['metadata']:
            meme = notebook['metadata']['lc_notebook_meme']
            if 'current' in meme:
                server_meme = meme['current']
        notebook.update(file)

        old_q = {'path': {'$regex': '{}$'.format(re.escape(file['path']))}}
        if server_meme is not None:
            old_q['metadata.lc_notebook_meme.current'] = server_meme
        old_notebooks = list(collection.find(old_q))
        if len(old_notebooks) == 0:
            # New notebook
            self.log.info('create: notebook={}'.format(file))
            newnb = collection.insert_one(notebook)
            notebook_id = newnb.inserted_id
        else:
            # Updated notebook
            notebook_id = old_notebooks[0]._id
            self.log.info('update: _id={}, notebook={}'.format(notebook_id, file))
            collection.update_one({'_id': notebook_id}, notebook)
        gfs.put(json.dumps(content).encode('utf8'), _id=notebook_id)

    def _normalize_key(self, key):
        return key.replace('.', '_')

    def _normalize_entity(self, entity):
        if type(entity) == dict:
            return dict([(self._normalize_key(k), self._normalize_entity(v)) for k, v in entity.items()])
        elif type(entity) == list:
            return [self._normalize_entity(e) for e in entity]
        return entity

    def normalize_output(self, output):
        r = {}
        for k, v in output.items():
            if k == 'text':
                r[k] = ''.join(v)
            else:
                r[k] = self._normalize_entity(v)
        return r

    def normalize_cell(self, cell):
        r = {}
        for k, v in cell.items():
            if k == 'source':
                r[k] = ''.join(v)
            elif k == 'outputs':
                r[k] = [self.normalize_output(e) for e in v]
            else:
                r[k] = self._normalize_entity(v)
        return r

    def normalize_notebook(self, content):
        r = {}
        for k, v in content.items():
            if k == 'cells':
                r[k] = [self.normalize_cell(e) for e in v]
            else:
                r[k] = self._normalize_entity(v)
        return r
