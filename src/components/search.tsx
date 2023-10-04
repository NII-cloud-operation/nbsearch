import React, { useCallback, useState } from 'react';
import { Box, Button, TableContainer } from '@mui/material';

import { Query } from './query';
import { ResultEntity } from './result';
import { Results, SortQuery } from './results';
import { Page } from './page';
import { PageQuery } from './page-control';


export type SearchError = {
  message: string;
}


export type SearchQuery = {
  queryString: string;
  sortQuery?: SortQuery;
  pageQuery?: PageQuery;
};


export type SearchProps = {
  onSearch?: (query: SearchQuery) => void;
  onResultSelect?: (result: ResultEntity) => void;
  start?: number;
  limit?: number;
  numFound?: number;
  results?: ResultEntity[];
  error?: SearchError;
};


function getSearchQuery(lastQuery: SearchQuery | null, queryString?: string): SearchQuery | null {
  if (!queryString) {
    return lastQuery;
  }
  if (!lastQuery) {
    return {
      queryString: queryString || '',
    };
  }
  return Object.assign({}, lastQuery, {
    queryString: queryString || '',
  });
}


export function Search(props: SearchProps): JSX.Element {
  const { onSearch, onResultSelect, start, limit, numFound, results, error } = props;
  const [solrQuery, setSolrQuery] = useState<string | null>('_text_: *');
  const [searchQuery, setSearchQuery] = useState<SearchQuery | null>(null);

  const solrQueryChanged = useCallback((query: string | null) => {
    setSolrQuery(query);
  }, []);
  const clicked = useCallback(() => {
    const query = getSearchQuery(searchQuery, solrQuery || '');
    setSearchQuery(query);
    if (query === null) {
      return;
    }
    if (!onSearch) {
      return;
    }
    onSearch(query);
  }, [solrQuery, onSearch]);
  const sorted = useCallback((sortQuery: SortQuery) => {
    const query = getSearchQuery(searchQuery);
    if (query === null) {
      return;
    }
    const newQuery: SearchQuery = Object.assign(query, {
      sortQuery,
    });
    setSearchQuery(newQuery);
    if (!onSearch) {
      return;
    }
    onSearch(newQuery);
  }, [onSearch]);
  const pageChanged = useCallback((pageQuery: PageQuery) => {
    const query = getSearchQuery(searchQuery);
    if (query === null) {
      return;
    }
    const newQuery: SearchQuery = Object.assign(query, {
      pageQuery,
    });
    setSearchQuery(newQuery);
    if (!onSearch) {
      return;
    }
    onSearch(newQuery);
  }, [onSearch]);
  return <Box sx={{ padding: '1em' }}>
    <Query onChange={ solrQueryChanged }/>
    <Button
      onClick={ clicked }
      disabled={solrQuery === null}
    >
      Search
    </Button>
    {error && <strong>{error.message}</strong>}
    <Page
      start={start}
      limit={limit}
      numFound={numFound}
      onPageChange={pageChanged}
    >
      <TableContainer>
        <Results
          onColumnSort={sorted}
          onResultSelect={onResultSelect}
          data={results}
        />
      </TableContainer>
    </Page>
  </Box>;
}