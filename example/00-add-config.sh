#!/bin/bash

set -xe

TARGET_CONFIG_DIR=/jupyter_notebook_config.d

if [[ -f /home/$NB_USER/.nbsearch/config_local.py ]] ; then
    cp /home/$NB_USER/.nbsearch/config_local.py ${TARGET_CONFIG_DIR}/nbsearch-config.py
else
    cp /home/$NB_USER/.nbsearch/config_base.py ${TARGET_CONFIG_DIR}/nbsearch-config.py
fi
