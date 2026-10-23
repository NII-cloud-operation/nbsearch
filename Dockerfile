FROM solr:10 AS solr

# Build the JupyterLab extensions where Node.js is available, so the runtime image needs neither Node.js nor the sources.
FROM quay.io/jupyter/minimal-notebook:notebook-7.6.3 AS build

USER root

RUN apt-get update && apt-get install -yq --no-install-recommends gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY . /tmp/nbsearch
RUN pip wheel --no-cache-dir --no-deps -w /tmp/wheels \
        /tmp/nbsearch \
        git+https://github.com/NII-cloud-operation/Jupyter-LC_nblineage.git@main \
        git+https://github.com/NII-cloud-operation/Jupyter-LC_notebook_diff.git@main \
        git+https://github.com/NII-cloud-operation/Jupyter-LC_index.git@main

FROM quay.io/jupyter/minimal-notebook:notebook-7.6.3

USER root

# Recreate the scipy-notebook package set without build-essential or Cython.
RUN apt-get update --yes && \
    apt-get install --yes --no-install-recommends \
    cm-super \
    ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

RUN mamba install --yes \
    'altair' \
    'beautifulsoup4' \
    'bokeh' \
    'bottleneck' \
    'cloudpickle' \
    'conda-forge::blas=*=openblas' \
    'dask' \
    'dill' \
    'h5py' \
    'ipympl' \
    'ipywidgets' \
    'jupyterlab-git' \
    'matplotlib-base' \
    'numba' \
    'numexpr' \
    'openpyxl' \
    'pandas' \
    'patsy' \
    'protobuf' \
    'pytables' \
    'scikit-image' \
    'scikit-learn' \
    'scipy' \
    'seaborn' \
    'sqlalchemy' \
    'statsmodels' \
    'sympy' \
    'widgetsnbextension' \
    'xlrd' && \
    mamba clean --all -f -y && \
    fix-permissions "${CONDA_DIR}" && \
    fix-permissions "/home/${NB_USER}"

RUN MPLBACKEND=Agg python -c "import matplotlib.pyplot" && \
    fix-permissions "/home/${NB_USER}"

USER root

### Remove nbclassic (we use Notebook 7; nbclassic ships unmaintained bundled JS)
RUN mamba remove -n base -y nbclassic && mamba clean --all -f -y

# Install OpenJDK and lsyncd
RUN apt-get update && apt-get install -yq supervisor lsyncd uuid-runtime \
    openjdk-21-jre tinyproxy netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Solr
COPY --from=solr /opt /opt/
RUN mkdir -p /var/solr
COPY --from=solr /var/solr /var/solr
ENV SOLR_USER="jovyan" \
    SOLR_GROUP="users" \
    PATH="/opt/solr/bin:/opt/solr/docker/scripts:$PATH" \
    SOLR_INCLUDE=/etc/default/solr.in.sh \
    SOLR_HOME=/var/solr/data \
    SOLR_PID_DIR=/var/solr \
    SOLR_LOGS_DIR=/var/solr/logs \
    LOG4J_PROPS=/var/solr/log4j2.xml
RUN chown jovyan:users -R /var/solr /run/tinyproxy

# Garage
ENV GARAGE_DEFAULT_ACCESS_KEY=nbsearchak GARAGE_DEFAULT_SECRET_KEY=nbsearchsecretkey
ARG TARGETARCH
RUN case "${TARGETARCH}" in amd64) arch=x86_64 ;; arm64) arch=aarch64 ;; *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; esac && \
    mkdir -p /opt/garage/bin/ && \
    curl -fsSL "https://garagehq.deuxfleurs.fr/_releases/v2.4.1/${arch}-unknown-linux-musl/garage" > /opt/garage/bin/garage && \
    chmod +x /opt/garage/bin/garage && mkdir -p /var/garage && chown jovyan:users -R /var/garage

COPY --from=build /tmp/wheels /tmp/wheels
RUN pip install --no-cache-dir /tmp/wheels/*.whl jupyter-server-proxy && \
    rm -rf /tmp/wheels && \
    jupyter server extension enable --sys-prefix jupyter_server_proxy && \
    jupyter server extension enable nbsearch && \
    jupyter labextension enable nbsearch && \
    jupyter labextension enable lc_notebook_diff && \
    jupyter labextension enable lc_index

COPY --chown=${NB_UID}:${NB_GID} example /tmp/nbsearch/example
COPY --chown=${NB_UID}:${NB_GID} solr /tmp/nbsearch/solr
COPY --chown=${NB_UID}:${NB_GID} images /tmp/nbsearch/images
COPY --chown=${NB_UID}:${NB_GID} README.md /tmp/nbsearch/README.md

RUN mkdir -p /usr/local/bin/before-notebook.d && \
    cp /tmp/nbsearch/example/00-add-config.sh /usr/local/bin/before-notebook.d/ && \
    cp /tmp/nbsearch/example/99-run-supervisor.sh /usr/local/bin/before-notebook.d/ && \
    chmod +x /usr/local/bin/before-notebook.d/*.sh && \
    cp /tmp/nbsearch/example/update-index /usr/local/bin/ && \
    chmod +x /usr/local/bin/update-index && \
    mkdir -p /opt/nbsearch/ && \
    cp -fr /tmp/nbsearch/solr /opt/nbsearch/ && \
    mkdir -p /jupyter_notebook_config.d && chown jovyan:users /jupyter_notebook_config.d

# Boot scripts to perform /usr/local/bin/before-notebook.d/* on JupyterHub
RUN mkdir -p /opt/nbsearch/original/bin/ && \
    mkdir -p /opt/nbsearch/bin/ && \
    mv /opt/conda/bin/jupyterhub-singleuser /opt/nbsearch/original/bin/jupyterhub-singleuser && \
    mv /opt/conda/bin/jupyter-notebook /opt/nbsearch/original/bin/jupyter-notebook && \
    mv /opt/conda/bin/jupyter-lab /opt/nbsearch/original/bin/jupyter-lab && \
    cp /tmp/nbsearch/example/jupyterhub-singleuser /opt/conda/bin/ && \
    cp /tmp/nbsearch/example/jupyter-notebook /opt/conda/bin/ && \
    cp /tmp/nbsearch/example/jupyter-lab /opt/conda/bin/ && \
    cp /tmp/nbsearch/example/run-hook.sh /opt/nbsearch/bin/ && \
    cp /tmp/nbsearch/example/build-index.sh /opt/nbsearch/bin/ && \
    cp /tmp/nbsearch/example/start-solr.sh /opt/nbsearch/bin/ && \
    chmod +x /opt/conda/bin/jupyterhub-singleuser /opt/conda/bin/jupyter-notebook /opt/conda/bin/jupyter-lab \
        /opt/nbsearch/bin/*.sh

RUN jupyter nblineage quick-setup --sys-prefix

# Configuration for Server Proxy
RUN cat /tmp/nbsearch/example/jupyter_notebook_config.py >> $CONDA_DIR/etc/jupyter/jupyter_notebook_config.py

USER $NB_UID

RUN mkdir -p /home/$NB_USER/.nbsearch && \
    cp /tmp/nbsearch/example/config_*.py /home/$NB_USER/.nbsearch/ && \
    mkdir /home/$NB_USER/.nbsearch/conf.d && \
    cp /tmp/nbsearch/example/supervisor.conf /home/$NB_USER/.nbsearch/supervisor.conf && \
    cp /tmp/nbsearch/example/garage.toml /home/$NB_USER/.nbsearch/garage.toml && \
    cp /tmp/nbsearch/example/update-index.lua /home/$NB_USER/.nbsearch/update-index.lua && \
    cp -fr /tmp/nbsearch/example/notebooks/* /home/$NB_USER/ && \
    cp /tmp/nbsearch/images/* /home/$NB_USER/images/ && \
    cp /tmp/nbsearch/README.md /home/$NB_USER/ && \
    rm -rf /tmp/nbsearch

VOLUME /var/solr /var/garage
