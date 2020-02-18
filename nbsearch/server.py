import os

from tornado import gen
import tornado.web

from .db import NBSearchDB
from .handlers import (MainHandler)
from .v1.handlers import (SearchHandler, DownloadHandler)


DEFAULT_STATIC_FILES_PATH = os.path.join(os.path.dirname(__file__), "static")
DEFAULT_TEMPLATE_PATH_LIST = [
    os.path.dirname(__file__),
    os.path.join(os.path.dirname(__file__), 'templates'),
]


def get_api_handlers(parent_app):
    dbconfig = NBSearchDB(parent=parent_app)
    db = dbconfig.get_database()

    handler_settings = {}
    handler_settings['database'] = db
    handler_settings['collection'] = db[dbconfig.collection]

    return [
        (r"/v1/search", SearchHandler, handler_settings),
        (r"/v1/download/(?P<id>[^\/]+)", DownloadHandler, handler_settings),
    ]


def register_routes(nb_server_app, web_app):
    from notebook.utils import url_path_join
    api_handlers = get_api_handlers(nb_server_app)

    host_pattern = '.*$'
    handlers = [(url_path_join(web_app.settings['base_url'], 'nbsearch', path),
                 handler,
                 options)
                for path, handler, options in api_handlers]
    web_app.add_handlers(host_pattern, handlers)


class ServerApp(tornado.web.Application):

    def __init__(self, nbsearch_app):
        settings = {}
        settings['static_path'] = DEFAULT_STATIC_FILES_PATH
        settings['template_path'] = DEFAULT_TEMPLATE_PATH_LIST[-1]

        handlers = get_api_handlers(nbsearch_app) + [
            (r"/", MainHandler),
            (r"/static/(.*)", tornado.web.StaticFileHandler)
        ]

        super(ServerApp, self).__init__(handlers, **settings)
