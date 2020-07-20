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

*TBD*

## Usage

### Add indexes of notebooks to MongoDB

*TBD*

### Search for Notebooks

*TBD*
