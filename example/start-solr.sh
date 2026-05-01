#!/bin/bash
set -e

init-var-solr
precreate-core jupyter-cell /opt/nbsearch/solr/jupyter-cell/
precreate-core jupyter-notebook /opt/nbsearch/solr/jupyter-notebook/

exec solr-foreground --user-managed
