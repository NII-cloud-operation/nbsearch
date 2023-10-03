import React, { useCallback, useState } from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';

import { Box } from '@mui/material';

import { searchIcon } from './icons';
import { Search, SearchError, SearchQuery } from '../components/search';
import { ResultEntity } from '../components/result';
import { requestAPI } from '../handler';
import { SortOrder } from '../components/results';



type SearchResponse = {
  notebooks: ResultEntity[];
  limit: number;
  start: number;
  numFound: number;
};


type NotebookResponse = {
  filename: string;
};


async function performSearch(query: SearchQuery): Promise<SearchResponse> {
  const params: {
    query: string,
    sort?: string,
    limit?: string,
    start?: string,
  } = {
    query: query.queryString,
  };
  const { sortQuery, pageQuery } = query;
  if (sortQuery) {
    params.sort = `${sortQuery.column} ${sortQuery.order === SortOrder.Ascending ? 'asc' : 'desc'}`
  }
  if (pageQuery) {
    params.limit = pageQuery.limit.toString();
    params.start = pageQuery.start.toString();
  }
  const resp = await requestAPI<SearchResponse>(
    `v1/notebook/search?${new URLSearchParams(params)}`,
  );
  return resp;
}


async function prepareNotebook(path: string, id: string): Promise<NotebookResponse> {
  const resp = await requestAPI<NotebookResponse>(
    `v1/import${path}/${id}`,
  );
  return resp;
}


type SearchWidgetProps = {
  documents: IDocumentManager;
}


export function SearchWidget(props: SearchWidgetProps): JSX.Element {
  const { documents } = props;
  const [results, setResults] = useState<ResultEntity[]>([]);
  const [page, setPage] = useState<{
    start: number,
    limit: number,
    numFound: number
  } | null>(null);
  const [error, setError] = useState<SearchError | undefined>(undefined);
  const searched = useCallback((query: SearchQuery) => {
    performSearch(query)
      .then((results) => {
        setError(undefined);
        setResults(results.notebooks);
        setPage({
          start: results.start,
          limit: results.limit,
          numFound: results.numFound,
        });
      })
      .catch((error) => {
        setError(error);
      });
  }, [results]);
  const selected = useCallback((result: ResultEntity) => {
    prepareNotebook('/nbsearch-tmp', result.id)
      .then((result) => {
        documents.openOrReveal(`/nbsearch-tmp/${result.filename}`);
      })
      .catch((error) => {
        setError(error);
      });
  }, [documents]);
  return <Box sx={{ overflow: 'auto' }}>
    <Search
      onSearch={searched}
      onResultSelect={selected}
      start={page?.start}
      limit={page?.limit}
      numFound={page?.numFound}
      results={results}
      error={error}
    />
  </Box>
}


export function buildWidget(documents: IDocumentManager, withLabel: boolean): ReactWidget {
  const widget = ReactWidget.create(
    <SearchWidget documents={documents} />
  );
  widget.id = 'nbsearch::notebooksearch';
  widget.title.icon = searchIcon;
  widget.title.caption = 'NBSearch';
  if (withLabel) {
    widget.title.label = 'NBSearch';
  }
  return widget;
}