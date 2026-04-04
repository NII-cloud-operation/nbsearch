"""Lightweight DB layer for Solr queries and S3 downloads.

Replaces Tornado's AsyncHTTPClient with httpx, keeps aioboto3 for S3.
"""

from __future__ import annotations

import io
import json
import logging
from urllib.parse import urlencode, urljoin

logger = logging.getLogger(__name__)

import os

import aioboto3
import httpx
from cachetools import TTLCache

from .config import Config

_notebook_cache: TTLCache = TTLCache(
    maxsize=int(os.environ.get("NOTEBOOK_CACHE_SIZE", "32")),
    ttl=3600,
)


class NBSearchDB:
    def __init__(self, config: Config) -> None:
        self._cfg = config

    # ---- Solr ---------------------------------------------------------

    def _solr_auth(self) -> httpx.BasicAuth | None:
        if self._cfg.solr.username or self._cfg.solr.password:
            return httpx.BasicAuth(self._cfg.solr.username, self._cfg.solr.password)
        return None

    async def query(
        self,
        core: str,
        query: str,
        *,
        q_op: str = "AND",
        start: int | None = None,
        rows: int | None = None,
        sort: str | None = None,
    ) -> dict:
        params: dict[str, str | int] = {"q": query, "q.op": q_op, "wt": "json"}
        if start is not None:
            params["start"] = start
        if rows is not None:
            params["rows"] = rows
        if sort is not None:
            params["sort"] = sort
        url = urljoin(
            self._cfg.solr.base_url + "/",
            f"solr/{core}/select?{urlencode(params)}",
        )
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, auth=self._solr_auth())
            resp.raise_for_status()
            data = resp.json()
            response = data["response"]
            logger.info(
                "query %s q=%s returned=%d numFound=%d",
                core, query, len(response["docs"]), response["numFound"],
            )
            return data

    async def query_notebooks(self, query: str, **kwargs) -> dict:
        return await self.query(self._cfg.solr.notebook_core, query, **kwargs)

    async def query_cells(self, query: str, **kwargs) -> dict:
        return await self.query(self._cfg.solr.cell_core, query, **kwargs)

    # ---- S3 -----------------------------------------------------------

    async def download_notebook(self, notebook_id: str) -> dict:
        cached = _notebook_cache.get(notebook_id)
        if cached is not None:
            return cached
        s3cfg = self._cfg.s3
        session = aioboto3.Session(
            aws_access_key_id=s3cfg.access_key,
            aws_secret_access_key=s3cfg.secret_key,
            region_name=s3cfg.region_name,
        )
        buf = io.BytesIO()
        async with session.client("s3", endpoint_url=s3cfg.endpoint_url) as s3:
            await s3.download_fileobj(s3cfg.bucket_name, notebook_id, buf)
        buf.seek(0)
        notebook = json.loads(buf.read().decode("utf-8"))
        _notebook_cache[notebook_id] = notebook
        return notebook
