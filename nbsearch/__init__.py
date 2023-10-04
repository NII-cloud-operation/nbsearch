"""The NBSearch Server"""

import os
from . import (
    server,
)

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'nbsearch' outside a proper installation.")
    __version__ = "dev"


def load_jupyter_server_extension(nb_server_app):
    nb_server_app.log.info('nbsearch extension started')
    server.register_routes(nb_server_app, nb_server_app.web_app)


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "nbsearch"
    }]


# nbextension
def _jupyter_nbextension_paths():
    notebook_ext = dict(section='notebook',
                        src='nbextension',
                        dest='nbsearch',
                        require='nbsearch/notebook')
    tree_ext = dict(section='tree',
                    src='nbextension',
                    dest='nbsearch',
                    require='nbsearch/tree')
    return [notebook_ext, tree_ext]


# server extension
def _jupyter_server_extension_paths():
    return [dict(module='nbsearch')]
