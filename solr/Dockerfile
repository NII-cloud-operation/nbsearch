FROM solr:10

COPY jupyter-cell /opt/nbsearch/solr/jupyter-cell
COPY jupyter-notebook /opt/nbsearch/solr/jupyter-notebook

CMD ["sh", "-c", "precreate-core jupyter-cell /opt/nbsearch/solr/jupyter-cell/ && precreate-core jupyter-notebook /opt/nbsearch/solr/jupyter-notebook/ && exec solr-fg --user-managed"]
