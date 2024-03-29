# nbsearch [![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/NII-cloud-operation/nbsearch/HEAD?urlpath=tree)

nbsearch extension provides search capabilities for Jupyter Notebooks, which you created. It supports search by MEME in addition to search by keywords and modified times like a search engine. Therefore, users can easily find cells of the same origin in sticky notes added by sidestickies.

## Prerequisite

Jupyter Notebook 6.x

## Installation

```
$ pip install git+https://github.com/NII-cloud-operation/nbsearch
```

To use nbsearch extension, you will also need to install and enable. You can use Jupyter subcommand:

```
$ jupyter nbextension install --py nbsearch
$ jupyter serverextension enable --py nbsearch
$ jupyter nbextension enable --py nbsearch
```

To compare multiple Notebooks, you need to install [Jupyter-LC_notebook_diff](https://github.com/NII-cloud-operation/Jupyter-LC_notebook_diff), as shown below.

```
$ pip install git+https://github.com/NII-cloud-operation/Jupyter-LC_notebook_diff
$ jupyter nbextension install --py lc_notebook_diff
$ jupyter nbextension enable --py lc_notebook_diff
```

then restart Jupyter notebook.

## Settings

In order to use nbsearch, [Solr](https://solr.apache.org/) and S3 compatible storage is required.
Solr is used as a search index and S3 compatible storage is used to store the Notebook data.

You must prepare a Solr server and a S3 compatible storage that can be connected from your Jupyter Notebook,
and describe the configuration in your jupyter_notebook_config.

### Setting up Solr

You need to install Solr and configure two cores with the following schemas.

1. [jupyter-notebook core](./solr/jupyter-notebook/)
1. [jupyter-cell core](./solr/jupyter-cell/)

### Prepare S3 compatible storage

You can use AWS S3 or [MinIO](https://min.io/) as your S3 compatible storage. Install if needed.

### Configuring Jupyter Notebook

You need to describe the following settings in `jupyter_notebook_config`.

```
c.NBSearchDB.solr_base_url = 'http://localhost:8983'
c.NBSearchDB.s3_endpoint_url = 'http://localhost:9000'
c.NBSearchDB.solr_basic_auth_username = 'USERNAME_FOR_SOLR'
c.NBSearchDB.solr_basic_auth_password = 'PASSWORD_FOR_SOLR'
c.NBSearchDB.s3_access_key = 'ACCESS_KEY_FOR_S3'
c.NBSearchDB.s3_secret_key = 'SECRET_KEY_FOR_S3'

c.LocalSource.base_dir = '/home/jovyan'
c.LocalSource.server = 'http://localhost:8888/'
```

* `c.NBSearchDB.solr_base_url` - The base URL of Solr(default: `http://localhost:8983`)
* `c.NBSearchDB.solr_basic_auth_username`, `c.NBSearchDB.solr_basic_auth_password` - The username and password for Solr(if needed)
* `c.NBSearchDB.s3_endpoint_url` - The URL of S3(default: http://localhost:9000)
* `c.NBSearchDB.s3_access_key`, `c.NBSearchDB.s3_secret_key` - The access key and secret key for S3(required)
* `c.NBSearchDB.s3_region_name` - The region name of S3(if needed)
* `c.NBSearchDB.s3_bucket_name` - The bucket on S3(required)
* `c.NBSearchDB.solr_notebook` - The core for notebooks on Solr(default: `jupyter-notebook`)
* `c.NBSearchDB.solr_cell` - The core for cells on Solr(default: `jupyter-cell`)
* `c.LocalSource.base_dir` - Notebook directory to be searchable
* `c.LocalSource.server` - URL of my server, used to identify the notebooks on this server(default: http://localhost:8888/)

## Usage

### Add indexes of notebooks to Solr

To make all your current notebooks searchable, run the following command. When you run this command, a collection for retrieval is prepared on the Solr.

```
$ jupyter nbsearch update-index $CONDA_DIR/etc/jupyter/jupyter_notebook_config.py --debug local
```

### Search for Notebooks

To search the Notebook, you can use the NBSearch tab.
The NBSearch tab allows you to search the Notebook. By clicking on the search result, you can check the contents of the Notebook.

![NBSearch tab](./images/search-notebook.gif)

### Search for Cells

To search the Cell, you can use the NBSearch search button.
The NBSearch pane allows searching of cells. You can search for preceding and subsequent cells using MEME and add it to the current Notebook.

![NBSearch pane](./images/search-cell.gif)
