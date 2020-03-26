#!/bin/bash

set -xe

# For MongoDB
supervisord -c /home/jovyan/.nbsearch/supervisor.conf

if [[ ! -f /home/$NB_USER/.nbsearch/config_local.py ]] ; then
    while ! nc -z localhost 27017; do
      sleep 0.1 # wait for 1/10 of the second before check again
    done
    jupyter nbsearch update-index /home/$NB_USER/.jupyter/jupyter_notebook_config.py local
fi

export SUPERVISOR_INITIALIZED=1
