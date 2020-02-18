#!/usr/bin/env python

from setuptools import setup, find_packages
import os
import shutil

HERE = os.path.abspath(os.path.dirname(__file__))
VERSION_NS = {}
with open(os.path.join(HERE, 'nbsearch', '_version.py')) as f:
    exec(f.read(), {}, VERSION_NS)

shutil.copyfile(os.path.join(HERE, 'nbsearch', 'static', 'js', 'search.js'),
                os.path.join(HERE, 'nbsearch', 'nbextension', 'search.js'))

setup_args = dict(name='nbsearch',
      version=VERSION_NS['__version__'],
      description='NBSearch Jupyter Extension',
      author='NII',
      packages=find_packages(),
      include_package_data=True,
      zip_safe=False,
      platforms=['Jupyter Notebook 6.x'],
      install_requires=[
          'notebook>=4.2.0',
          'motor',
      ],
     )

if __name__ == '__main__':
    setup(**setup_args)
