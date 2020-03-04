FROM niicloudoperation/notebook

USER root

COPY . /tmp/nbsearch
RUN pip install /tmp/nbsearch jupyter_nbextensions_configurator
RUN mkdir -p /usr/local/bin/before-notebook.d && \
    cp /tmp/nbsearch/example/*.sh /usr/local/bin/before-notebook.d/ && \
    chmod +x /usr/local/bin/before-notebook.d/*.sh

USER $NB_UID

RUN mkdir -p /home/$NB_USER/.nbsearch && \
    cp /tmp/nbsearch/example/config_local.py /home/$NB_USER/.nbsearch/config_local.py

RUN jupyter nbextensions_configurator enable --user && \
    jupyter nbextension install --py --user nbsearch && \
    jupyter serverextension enable --py --user nbsearch && \
    jupyter nbextension enable --py --user nbsearch && \
    jupyter nbextension enable --py --user lc_notebook_diff
