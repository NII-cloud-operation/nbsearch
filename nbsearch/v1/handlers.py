from datetime import datetime
import json
import os
from stat import S_IREAD

from jupyter_server.base.handlers import APIHandler
from tornado import web
import tornado.escape
import tornado.ioloop
import tornado.web


NBSEARCH_TMP = 'nbsearch-tmp'


class SearchHandler(APIHandler):
    def initialize(self, db, base_dir):
        self.db = db

    @web.authenticated
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
            '{}s'.format(target): result['response']['docs'] if 'response' in result else None,
            'limit': limit,
            'size': result['response']['numFound'] if 'response' in result else limit,
            'start': result['response']['start'] if 'response' in result else start,
            'numFound': result['response']['numFound'] if 'response' in result else None,
            'sort': sort,
            'solrquery': solrquery,
            'error': result['error'] if 'error' in result else None,
        }
        self.write(resp)

    def _get_page(self):
        start = self.get_query_argument('start', '0')
        limit = self.get_query_argument('limit', '50')
        return int(start), int(limit)


class ImportHandler(APIHandler):
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

    @web.authenticated
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
        to_tmp = False
        if path == NBSEARCH_TMP:
            os.makedirs(os.path.join(self.base_dir, NBSEARCH_TMP),
                        exist_ok=True)
            to_tmp = True
        full_path = os.path.join(self.base_dir, path, filename)
        with open(full_path, 'wb') as f:
            await self.db.download_file(id, f)
        if to_tmp:
            os.chmod(full_path, S_IREAD)
        self.write({'filename': filename})
