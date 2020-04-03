import os
import sys

from ._version import __version__

from traitlets.config.application import catch_config_error
from traitlets.config.application import Application
from traitlets import Dict, List

from .db import UpdateIndexHandler


class UpdateIndexApp(Application):
    """Update Index of MongoDB"""
    name = "jupyter nbsearch update-index"
    description = "Update Index of MongoDB"
    version = __version__

    examples = """
        jupyter nbsearch update-index [options] <config-path> <source> <path>
    """

    classes = List([UpdateIndexHandler])
    aliases = Dict({'log-level': 'Application.log_level'})
    flags = Dict({'debug': ({'Application': {'log_level': 10}},
                            'Set loglevel to DEBUG')})

    @catch_config_error
    def initialize(self, argv=None):
        super(UpdateIndexApp, self).initialize(argv)
        self.handler = UpdateIndexHandler(config=self.config)

    def start(self):
        if len(self.extra_args) < 2:
            self.print_help()
            sys.exit(-1)
        config_path = self.extra_args[0]
        source = self.extra_args[1]
        path = self.extra_args[2] if len(self.extra_args) == 3 else None
        self.handler.update(config_path, source, path)


class ExtensionApp(Application):
    '''CLI for extension management.'''
    name = u'jupyter_nbsearch extension'
    description = u'Utilities for managing the jupyter_nbsearch extension'
    examples = ""
    version = __version__

    subcommands = dict()

    subcommands.update({
        "update-index": (
            UpdateIndexApp,
            "Update Index of MongoDB"
        ),
    })

    def _classes_default(self):
        classes = super(ExtensionApp, self)._classes_default()

        # include all the apps that have configurable options
        for appname, (app, help) in self.subcommands.items():
            if len(app.class_traits(config=True)) > 0:
                classes.append(app)

    @catch_config_error
    def initialize(self, argv=None):
        super(ExtensionApp, self).initialize(argv)

    def start(self):
        if self.subapp is None:
            self.print_help()
            sys.exit(1)

        super(ExtensionApp, self).start()


def main():
    ExtensionApp.launch_instance()
