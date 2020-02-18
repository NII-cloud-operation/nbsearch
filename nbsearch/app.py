import os

import tornado.ioloop
from traitlets.config.application import Application, catch_config_error
from traitlets.config.loader import ConfigFileNotFound
from traitlets import Int

from .server import ServerApp


class NoStart(Exception):
    """Exception to raise when an application shouldn't start"""

class NBSearchApp(Application):
    name = 'nbsearch'
    description = "A NBSearch Application"

    port = Int(9999, help='Port of NBSearch').tag(config=True)

    @property
    def config_file_paths(self):
        return [os.getcwd()]

    def load_config_file(self, suppress_errors=True):
        base_config = 'nbsearch_config'
        try:
            super(NBSearchApp, self).load_config_file(
                base_config,
                path=self.config_file_paths,
            )
        except ConfigFileNotFound:
            # ignore errors loading parent
            self.log.debug("Config file %s not found", base_config)
            pass

    def start(self):
        app = ServerApp(self)
        app.listen(self.port)
        tornado.ioloop.IOLoop.current().start()

    @catch_config_error
    def initialize(self, argv=None):
        self.load_config_file()

    @classmethod
    def launch_instance(cls, argv=None, **kwargs):
        try:
            return super(NBSearchApp, cls).launch_instance(argv=argv, **kwargs)
        except NoStart:
            return


if __name__ == "__main__":
    NBSearchApp.launch_instance()
