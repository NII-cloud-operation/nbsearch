from datetime import datetime
import json
import os

from tornado import gen
import tornado.escape
import tornado.ioloop
import tornado.web

from bson.objectid import ObjectId
from motor import motor_tornado

from . import query


class BaseHandler(tornado.web.RequestHandler):
    def initialize(self, database, collection, history, base_dir):
        self.collection = collection
        self.history = history

    def _get_nq(self):
        nq = self.get_query_argument('nq', None)
        if nq is not None:
            return json.loads(nq)
        meme = self.get_query_argument('meme', None)
        if meme is not None:
            return query.nq_from_meme(meme)
        q = self.get_query_argument('q', None)
        if q is not None:
            return query.nq_from_q(q)
        return None


class SearchHandler(BaseHandler):
    async def get(self):
        start, limit = self._get_page()
        nq = self._get_nq()
        agg_q = await query.mongo_agg_query_from_nq(nq, self.history)
        if len(agg_q) == 0:
            mongo_q = self.collection.find({})
        elif len(agg_q) == 1 and '$match' in agg_q[0]:
            mongo_q = self.collection.find(agg_q[0]['$match'])
        else:
            mongo_q = self.collection.aggregate(agg_q)
        result = mongo_q.skip(start).limit(limit)
        notebooks = await result.to_list(length=limit)
        notebooks = [self._filter(n) for n in notebooks]
        resp = {
            'notebooks': notebooks,
            'limit': limit,
            'size': len(notebooks),
            'start': start,
            'nq': nq
        }
        self.write(resp)

    def _filter(self, notebook):
         return dict([('id', str(v)) if k == '_id' else (k, self._normalize(v))
                      for k, v in notebook.items()])

    def _normalize(self, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _get_page(self):
        start = self.get_query_argument('start', '0')
        limit = self.get_query_argument('limit', '50')
        return int(start), int(limit)


class HistoryHandler(BaseHandler):
    async def get(self):
        nq = self._get_nq()
        mongo_q = self.history.find()
        notebooks = []
        async for doc in mongo_q:
            notebooks.append({
                'id': str(doc['_id']),
                'text': doc['text'],
                'notebooks': None if 'notebook_ids' not in doc else len(doc['notebook_ids'])
            })
        resp = {
            'histories': notebooks,
        }
        self.write(resp)

    async def put(self):
        json_data = tornado.escape.json_decode(self.request.body)
        nq = self._get_nq()
        agg_q = await query.mongo_agg_query_from_nq(nq, self.history)
        if len(agg_q) == 1 and '$match' in agg_q[0]:
            mongo_q = self.collection.find(agg_q[0]['$match'])
        else:
            mongo_q = self.collection.aggregate(agg_q)
        notebook_ids = []
        async for doc in mongo_q:
            notebook_ids.append(str(doc['_id']))
        await self.history.insert_one({
            'text': json_data['name'],
            'notebook_ids': notebook_ids
        })
        resp = {
            'notebook_ids': notebook_ids,
            'nq': nq
        }
        self.write(resp)


class DownloadHandler(tornado.web.RequestHandler):
    def initialize(self, database, collection, history, base_dir):
        self.database = database
        self.collection = collection

    async def get(self, id):
        fs = motor_tornado.MotorGridFSBucket(self.database)
        file_id = ObjectId(id)
        notebook = await self.collection.find_one({'_id': file_id})
        filename = os.path.basename(notebook['path'])

        self.set_header('Content-Disposition', 'attachment; filename="{}"'.format(filename).encode('utf8'))
        self.set_header('Content-Type', 'application/json; charset=utf-8')
        await fs.download_to_stream(file_id, self)
        self.finish()


class ImportHandler(tornado.web.RequestHandler):
    def initialize(self, database, collection, history, base_dir):
        self.database = database
        self.collection = collection
        self.base_dir = base_dir

    def _has_special(self, path):
        if '/' not in path:
            return path == '..' or path == '.'
        parent, target = os.path.split(path)
        if target == '..' or target == '.':
            return True
        return self._has_special(parent)

    def _unique_filename(self, path, filename):
        if not os.path.exists(os.path.join(self.base_dir, path, filename)):
            return filename
        base_filename, ext = os.path.splitext(filename)
        index = 1
        alt_filename = '{} ({}){}'.format(base_filename, index, ext)
        while os.path.exists(os.path.join(self.base_dir, path, alt_filename)):
            index += 1
            alt_filename = '{} ({}){}'.format(base_filename, index, ext)
        return alt_filename

    async def get(self, path, id):
        fs = motor_tornado.MotorGridFSBucket(self.database)
        file_id = ObjectId(id)
        notebook = await self.collection.find_one({'_id': file_id})
        filename = os.path.basename(notebook['path'])
        if path is not None and path.startswith('/'):
            path = path[1:]
        if path is not None and self._has_special(path):
            raise tornado.web.HTTPError(400)
        path = path if path is not None else '.'
        filename = self._unique_filename(path, filename)
        with open(os.path.join(self.base_dir, path, filename), 'wb') as f:
            await fs.download_to_stream(file_id, f)
        self.write({'filename': filename})
