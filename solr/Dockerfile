FROM solr:8

COPY jupyter-cell /opt/nbsearch/solr/jupyter-cell
COPY jupyter-notebook /opt/nbsearch/solr/jupyter-notebook

RUN precreate-core jupyter-cell /opt/nbsearch/solr/jupyter-cell/ && \
    precreate-core jupyter-notebook /opt/nbsearch/solr/jupyter-notebook/
