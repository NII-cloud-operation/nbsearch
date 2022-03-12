from datetime import datetime
import json
import os

from tornado import gen
import tornado.escape
import tornado.ioloop
import tornado.web


class SearchHandler(tornado.web.RequestHandler):
    def initialize(self, db, base_dir):
        self.db = db

    async def get(self, target):
        start, limit = self._get_page()
        sort = self.get_query_argument('sort', None)
        query = self.get_query_argument('query')
        q_op = self.get_query_argument('q_op', 'AND')
        solrquery, result = await self.db.query(
            f'jupyter-{target}',
            query,
            q_op=q_op,
            start=start,
            rows=limit,
            sort=sort
        )
        resp = {
            'notebooks': result['response']['docs'] if 'response' in result else None,
            'limit': limit,
            'size': result['response']['numFound'] if 'response' in result else limit,
            'start': result['response']['start'] if 'response' in result else start,
            'sort': sort,
            'solrquery': solrquery,
            'error': result['error'] if 'error' in result else None,
        }
        self.write(resp)

    def _get_page(self):
        start = self.get_query_argument('start', '0')
        limit = self.get_query_argument('limit', '50')
        return int(start), int(limit)


class ImportHandler(tornado.web.RequestHandler):
    def initialize(self, db, base_dir):
        self.db = db
        self.base_dir = base_dir

    def _has_special(self, path):
        if path == '/' or path == '':
            return False
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
        solrquery, result = await self.db.query(
            'jupyter-notebook',
            f'id:"{id}"',
        )
        docs = result['response']['docs']
        if len(docs) == 0:
            raise tornado.web.HTTPError(404)
        notebook = docs[0]
        _, filename = os.path.split(notebook['filename'])
        if path is not None and path.startswith('/'):
            path = path[1:]
        if path is not None and path.startswith('/'):
            raise tornado.web.HTTPError(400)
        if path is not None and self._has_special(path):
            raise tornado.web.HTTPError(400)
        path = path if path is not None else '.'
        filename = self._unique_filename(path, filename)
        if path == 'nbsearch-tmp':
            os.makedirs(os.path.join(self.base_dir, 'nbsearch-tmp'),
                        exist_ok=True)
        with open(os.path.join(self.base_dir, path, filename), 'wb') as f:
            await self.db.download_file(id, f)
        self.write({'filename': filename})
