import io
import json
import os
import re
from urllib.parse import urljoin, urlencode

from tornado.httpclient import AsyncHTTPClient, HTTPRequest
from tornado.web import HTTPError

from traitlets import Unicode, Int
from traitlets.config.configurable import Configurable
from traitlets.config import LoggingConfigurable
from traitlets.config.loader import PyFileConfigLoader
import aioboto3

from .source import get_source
from . import solr


class NBSearchDB(Configurable):

    solr_base_url = Unicode('http://localhost:8983', help='The base url of Solr').tag(config=True)

    solr_basic_auth_username = Unicode(help='The username for the basic authentication of Solr').tag(config=True)

    solr_basic_auth_password = Unicode(help='The password for the basic authentication of Solr').tag(config=True)

    s3_endpoint_url = Unicode('http://localhost:9000', help='The endpoint of S3').tag(config=True)

    s3_access_key = Unicode(help='The access key of S3').tag(config=True)

    s3_secret_key = Unicode(help='The secret key of S3').tag(config=True)

    s3_region_name = Unicode(None, help='The region name of S3', allow_none=True).tag(config=True)

    s3_bucket_name = Unicode('notebooks', help='The bucket on S3').tag(config=True)

    solr_notebook = Unicode('jupyter-notebook', help='The core for notebooks on Solr').tag(config=True)

    solr_cell = Unicode('jupyter-cell', help='The core for cells on Solr').tag(config=True)

    async def post_document(self, core_internal, jsondoc):
        core = self.solr_cell if core_internal == 'jupyter-cell' else self.solr_notebook
        http_client = AsyncHTTPClient()
        response = await http_client.fetch(HTTPRequest(
            urljoin(self.solr_base_url, f'solr/{core}/update?commit=true'),
            method='POST',
            body=json.dumps(jsondoc),
            headers={'Content-Type': 'application/json'},
            **self._http_kwargs(),
        ))

    def _build_query(self, query, q_op=None, start=None, rows=None, sort=None):
        params = {}
        params['q.op'] = q_op or 'AND'
        params['q'] = query
        if start is not None:
            params['start'] = start
        if rows is not None:
            params['rows'] = rows
        if sort is not None:
            params['sort'] = sort
        return urlencode(params)

    async def query(self, core_internal, query, q_op=None, start=None, rows=None, sort=None):
        core = self.solr_cell if core_internal == 'jupyter-cell' else self.solr_notebook
        urlquery = self._build_query(query, q_op=q_op, start=start, rows=rows, sort=sort)
        http_client = AsyncHTTPClient()
        response = await http_client.fetch(HTTPRequest(
            urljoin(self.solr_base_url, f'solr/{core}/select?{urlquery}'),
            method='GET',
            **self._http_kwargs(),
        ), raise_error=False)
        if response.code >= 500:
            raise HTTPError(response.code)
        return urlquery, json.loads(response.body)

    async def _ensure_bucket(self, s3):
        buckets = await s3.list_buckets()
        bucket_names = [b['Name'] for b in buckets['Buckets']]
        if self.s3_bucket_name in bucket_names:
            return
        await s3.create_bucket(Bucket=self.s3_bucket_name)

    async def upload_file(self, notebook_id, notebook_data):
        session = aioboto3.Session(
            aws_access_key_id=self.s3_access_key,
            aws_secret_access_key=self.s3_secret_key,
            region_name=self.s3_region_name,
        )
        async with session.client('s3', endpoint_url=self.s3_endpoint_url) as s3:
            await self._ensure_bucket(s3)
            data = io.BytesIO(json.dumps(notebook_data, ensure_ascii=False).encode('utf8'))
            await s3.upload_fileobj(data, self.s3_bucket_name, notebook_id)

    async def download_file(self, notebook_id, f):
        session = aioboto3.Session(
            aws_access_key_id=self.s3_access_key,
            aws_secret_access_key=self.s3_secret_key,
            region_name=self.s3_region_name,
        )
        async with session.client('s3', endpoint_url=self.s3_endpoint_url) as s3:
            await s3.download_fileobj(self.s3_bucket_name, notebook_id, f)

    def _http_kwargs(self):
        if self.solr_basic_auth_username or self.solr_basic_auth_password:
            return {
                'auth_mode': 'basic',
                'auth_username': self.solr_basic_auth_username,
                'auth_password': self.solr_basic_auth_password,
            }
        return {}



class UpdateIndexHandler(LoggingConfigurable):

    def __init__(self, **kwargs):
        super(UpdateIndexHandler, self).__init__(**kwargs)

    async def update(self, cpath, source_path, path):
        self.log.info('updating indices for {}, {}({})'.format(source_path, path, cpath))
        self.config.merge(PyFileConfigLoader(cpath).load_config())
        db = NBSearchDB(config=self.config)
        source = get_source(source_path, self.config)

        updated = 0
        failed = []
        for file in source.get_files():
            if path is not None and os.path.split(file['path'])[-1] != os.path.split(path)[-1]:
                continue
            try:
                notebook_data = source.get_notebook(file['server'], file['path'])
                attr = dict([(k, v) for k, v in file.items()
                             if k in ['server', 'owner', 'mtime', 'ctime', 'atime'] and v is not None])
                r = solr.ipynb_to_documents(file['path'], notebook_data, attr=attr)
                results = []
                for core, docs in r.items():
                    self.log.info(f"{file['path']} - {core}")
                    await db.post_document(core, docs)
                    updated += 1
                    if core != 'jupyter-notebook':
                        continue
                    await db.upload_file(docs[0]['id'], notebook_data)
                updated += 1
            except:
                self.log.exception('failed to update index for {}'.format(file['path']))
                failed.append(file)
        self.log.info('finished: {} updates, {} fails'.format(updated, len(failed)))
        if len(failed) > 0:
            raise RuntimeError('Failed to update: {}'.format(','.join([f['path'] for f in failed])))
