import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, TableContainer } from '@mui/material';

import { ResultEntity } from './result/result';
import { Results, SortQuery } from './result/results';
import { Page } from './page';
import { PageQuery } from './page-control';
import { SolrQuery } from './query/base';
import { ResultColumn } from './result/results';

const COLUMN_MAX_LENGTH = 32;

export type SearchError = {
  message: string;
};

export type SearchQuery = {
  queryString: string;
  sortQuery?: SortQuery;
  pageQuery?: PageQuery;
  q_op?: string;
};

export type SearchProps = {
  columns: ResultColumn[];
  onSearch?: (query: SearchQuery) => void;
  onResultSelect?: (result: ResultEntity) => void;
  defaultQuery: SolrQuery;
  queryFactory: (
    onChange: (query: SolrQuery) => void
  ) => React.ReactNode | null;
  readyToSearch?: boolean;
  start?: number;
  limit?: number;
  numFound?: number;
  results?: ResultEntity[];
  error?: SearchError;
};

export function Search({
  columns,
  onSearch,
  onResultSelect,
  start,
  limit,
  numFound,
  results,
  error,
  readyToSearch,
  defaultQuery,
  queryFactory
}: SearchProps): JSX.Element {
  const [solrQuery, setSolrQuery] = useState<SolrQuery | null>(null);
  const [sortQuery, setSortQuery] = useState<SortQuery | null>(null);
  const [pageQuery, setPageQuery] = useState<PageQuery | null>(null);
  const searchQuery = useMemo(() => {
    const r: SearchQuery = Object.assign(
      {},
      solrQuery !== null ? solrQuery : defaultQuery
    );
    if (sortQuery) {
      r.sortQuery = sortQuery;
    }
    if (pageQuery) {
      r.pageQuery = pageQuery;
    }
    return r;
  }, [solrQuery, sortQuery, pageQuery, defaultQuery]);

  const solrQueryChanged = useCallback((query: SolrQuery) => {
    setSolrQuery(query);
  }, []);
  const clicked = useCallback(() => {
    if (!onSearch) {
      return;
    }
    onSearch(searchQuery);
  }, [onSearch, searchQuery]);
  const sorted = useCallback(
    (sortQuery: SortQuery) => {
      setSortQuery(sortQuery);
      const newQuery = Object.assign({}, searchQuery, { sortQuery });
      if (!onSearch) {
        return;
      }
      onSearch(newQuery);
    },
    [searchQuery, onSearch]
  );
  const pageChanged = useCallback(
    (pageQuery: PageQuery) => {
      setPageQuery(pageQuery);
      const newQuery = Object.assign({}, searchQuery, { pageQuery });
      if (!onSearch) {
        return;
      }
      onSearch(newQuery);
    },
    [searchQuery, onSearch]
  );

  return (
    <Box sx={{ padding: '1em' }}>
      {queryFactory(solrQueryChanged)}
      <Button onClick={clicked} disabled={readyToSearch === false}>
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
            columns={columns}
            onColumnSort={sorted}
            onResultSelect={onResultSelect}
            data={results}
            maxLength={COLUMN_MAX_LENGTH}
          />
        </TableContainer>
      </Page>
    </Box>
  );
}
