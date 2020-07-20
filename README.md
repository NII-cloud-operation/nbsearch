# nbsearch [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/NII-cloud-operation/nbsearch/master)

nbsearch extension provides search capabilities for Jupyter Notebooks which you created. It supports search by MEME in addition to search by keywords and modified times like a search engine. Therefore, users can easily find cells of the same origin in sticky notes added by sidestickies.

## Prerequisite

Jupyter Notebook 6.x

## Installation

```
$ pip install git+https://github.com/NII-cloud-operation/nbsearch
```

To use nbearch extension you will also need to install and enable, you can use Jupyter subcommand:

```
$ jupyter nbextension install --py nbsearch
$ jupyter serverextension enable --py nbsearch
$ jupyter nbextension enable --py nbsearch
```

To compare multiple Notebooks, you need to install [Jupyter-LC_notebook_diff](https://github.com/NII-cloud-operation/Jupyter-LC_notebook_diff) as shown below.

```
$ pip install git+https://github.com/NII-cloud-operation/Jupyter-LC_notebook_diff
$ jupyter nbextension install --py lc_notebook_diff
$ jupyter nbextension enable --py lc_notebook_diff
```

then restart Jupyter notebook.

## Settings

In order to use nbsearch, [MongoDB](https://www.mongodb.com/) is required.
You must prepare a MongoDB that can be connected from your Jupyter Notebook,
and describe the following configuration in your jupyter_notebook_config.

```
c.NBSearchDB.hostname = 'localhost'
c.NBSearchDB.port = 'localhost'
c.NBSearchDB.database = 'test_db'
c.NBSearchDB.collection = 'test_notebooks'
c.NBSearchDB.history = 'test_history'
c.NBSearchDB.username = ''
c.NBSearchDB.password = ''

c.LocalSource.base_dir = '/home/jovyan'
c.LocalSource.server = 'http://localhost:8888/'
```

* `c.NBSearchDB.hostname`, `c.NBSearchDB.port` - Hostname and port of the MongoDB(default: localhost:27017)
* `c.NBSearchDB.username`, `c.NBSearchDB.password` - Username and password of the MongoDB(if needed)
* `c.NBSearchDB.database` - Database name in the MongoDB(default: nbsearch)
* `c.NBSearchDB.collection` - Collection name which notebooks are stored in the Database(default: notebooks)
* `c.NBSearchDB.history` - Collection name which search history are stored in the Database(default: history)
* `c.LocalSource.base_dir` - Notebook directory to be searchable
* `c.LocalSource.server` - URL of my server, used to identify the notebooks on this server(default: http://localhost:8888/)

## Usage

### Add indexes of notebooks to MongoDB

*TBD*

### Search for Notebooks

*TBD*

### Search using chrome extension

*TBD*
