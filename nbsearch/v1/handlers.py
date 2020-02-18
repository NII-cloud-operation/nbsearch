from datetime import datetime
import os

from tornado import gen
import tornado.ioloop
import tornado.web

from bson.objectid import ObjectId
from motor import motor_tornado


class SearchHandler(tornado.web.RequestHandler):
    def initialize(self, database, collection):
        self.collection = collection

    async def get(self):
        start, limit = self._get_page()
        result = self.collection.find(self._get_mongo_query()).skip(start).limit(limit)
        notebooks = await result.to_list(length=limit)
        notebooks = [self._filter(n) for n in notebooks]
        resp = {'notebooks': notebooks, 'limit': limit,
                'size': len(notebooks), 'start': start}
        self.write(resp)

    def _filter(self, notebook):
         return dict([('id', str(v)) if k == '_id' else (k, self._normalize(v))
                      for k, v in notebook.items()])

    def _normalize(self, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _get_mongo_query(self):
        meme = self.get_query_argument('meme', None)
        if meme is not None:
            return {'cells.metadata.lc_cell_meme.current': meme}
        query = self.get_query_argument('q', None)
        if query is not None:
            return {'$text': {'$search': query}}
        return None

    def _get_page(self):
        start = self.get_query_argument('start', '0')
        limit = self.get_query_argument('limit', '50')
        return int(start), int(limit)


class DownloadHandler(tornado.web.RequestHandler):
    def initialize(self, database, collection):
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
