#!/bin/bash

if [[ -f /home/$NB_USER/.nbsearch/config_local.py ]] ; then
    cat /home/$NB_USER/.nbsearch/config_local.py >> /home/$NB_USER/.jupyter/jupyter_notebook_config.py
else
    cat /home/$NB_USER/.nbsearch/config_base.py >> /home/$NB_USER/.jupyter/jupyter_notebook_config.py
fi
