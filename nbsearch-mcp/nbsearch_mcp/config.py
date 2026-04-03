from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SolrConfig:
    base_url: str = "http://localhost:8983"
    username: str = ""
    password: str = ""
    notebook_core: str = "jupyter-notebook"
    cell_core: str = "jupyter-cell"


@dataclass(frozen=True)
class S3Config:
    endpoint_url: str = "http://localhost:9000"
    access_key: str = ""
    secret_key: str = ""
    region_name: str | None = None
    bucket_name: str = "notebooks"


@dataclass(frozen=True)
class Config:
    solr: SolrConfig = field(default_factory=SolrConfig)
    s3: S3Config = field(default_factory=S3Config)


def load_config() -> Config:
    return Config(
        solr=SolrConfig(
            base_url=os.environ.get("SOLR_BASE_URL", "http://localhost:8983"),
            username=os.environ.get("SOLR_BASIC_AUTH_USERNAME", ""),
            password=os.environ.get("SOLR_BASIC_AUTH_PASSWORD", ""),
            notebook_core=os.environ.get("SOLR_NOTEBOOK_CORE", "jupyter-notebook"),
            cell_core=os.environ.get("SOLR_CELL_CORE", "jupyter-cell"),
        ),
        s3=S3Config(
            endpoint_url=os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000"),
            access_key=os.environ.get("S3_ACCESS_KEY", ""),
            secret_key=os.environ.get("S3_SECRET_KEY", ""),
            region_name=os.environ.get("S3_REGION_NAME") or None,
            bucket_name=os.environ.get("S3_BUCKET_NAME", "notebooks"),
        ),
    )
