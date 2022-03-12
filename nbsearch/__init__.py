"""The NBSearch Server"""

import os
from . import (
    server,
)


DEFAULT_STATIC_FILES_PATH = server.DEFAULT_STATIC_FILES_PATH
DEFAULT_TEMPLATE_PATH_LIST = server.DEFAULT_TEMPLATE_PATH_LIST


def load_jupyter_server_extension(nb_server_app):
    nb_server_app.log.info('nbsearch extension started')
    server.register_routes(nb_server_app, nb_server_app.web_app)


# nbextension
def _jupyter_nbextension_paths():
    return [dict(section='tree',
                 src='nbextension',
                 dest='nbsearch',
                 require='nbsearch/main')]


# server extension
def _jupyter_server_extension_paths():
    return [dict(module='nbsearch')]
