import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, TableContainer } from '@mui/material';

import { ResultEntity } from './result/result';
import { Results, SortQuery } from './result/results';
import { Page } from './page';
import { PageQuery } from './page-control';
import { LazySolrQuery, SolrQuery, SolrQueryContext } from './query/base';
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
  onSearch?: (query: SearchQuery, finished: () => void) => void;
  onResultSelect?: (result: ResultEntity) => void;
  onResultAdd?: (result: ResultEntity) => void;
  showAddButton?: boolean;
  defaultQuery: SolrQuery;
  queryFactory: (
    onChange: (query: LazySolrQuery) => void
  ) => React.ReactNode | null;
  queryContext: SolrQueryContext;
  readyToSearch?: boolean;
  start?: number;
  limit?: number;
  numFound?: number;
  results?: ResultEntity[];
  error?: SearchError;
  onClosed?: () => void;
};

export function Search({
  columns,
  onSearch,
  onResultSelect,
  onResultAdd,
  showAddButton,
  start,
  limit,
  numFound,
  results,
  error,
  readyToSearch,
  defaultQuery,
  queryFactory,
  queryContext,
  onClosed
}: SearchProps): JSX.Element {
  const [solrQuery, setSolrQuery] = useState<LazySolrQuery | null>(null);
  const [sortQuery, setSortQuery] = useState<SortQuery | null>(null);
  const [pageQuery, setPageQuery] = useState<PageQuery | null>(null);
  const [searching, setSearching] = useState<boolean>(false);
  const searchQuery = useMemo(() => {
    const r: SearchQuery = Object.assign(
      {},
      solrQuery !== null ? solrQuery.get(queryContext) : defaultQuery
    );
    if (sortQuery) {
      r.sortQuery = sortQuery;
    }
    if (pageQuery) {
      r.pageQuery = pageQuery;
    }
    return r;
  }, [solrQuery, sortQuery, pageQuery, defaultQuery, queryContext]);

  const solrQueryChanged = useCallback((query: LazySolrQuery) => {
    setSolrQuery(query);
  }, []);
  const callSearch = useCallback(
    (query: SearchQuery) => {
      if (!onSearch) {
        return;
      }
      setSearching(true);
      onSearch(query, () => {
        setSearching(false);
      });
    },
    [onSearch]
  );
  const clicked = useCallback(() => {
    callSearch(searchQuery);
  }, [callSearch, searchQuery]);
  const sorted = useCallback(
    (sortQuery: SortQuery) => {
      setSortQuery(sortQuery);
      const newQuery = Object.assign({}, searchQuery, { sortQuery });
      callSearch(newQuery);
    },
    [searchQuery, onSearch]
  );
  const pageChanged = useCallback(
    (pageQuery: PageQuery) => {
      setPageQuery(pageQuery);
      const newQuery = Object.assign({}, searchQuery, { pageQuery });
      callSearch(newQuery);
    },
    [searchQuery, callSearch]
  );

  return (
    <Box sx={{ padding: '1em' }}>
      {queryFactory(solrQueryChanged)}
      <Box className="nbsearch-search-execute">
        {error && (
          <strong className="nbsearch-search-error">{error.message}</strong>
        )}
        <Button
          variant="contained"
          onClick={clicked}
          disabled={readyToSearch === false || searching}
        >
          {!searching ? 'Search' : 'Searching...'}
        </Button>
        {onClosed && (
          <Button variant="outlined" onClick={onClosed} sx={{ ml: 1 }}>
            Close
          </Button>
        )}
      </Box>
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
            onResultAdd={onResultAdd}
            showAddButton={showAddButton}
            data={results}
            maxLength={COLUMN_MAX_LENGTH}
          />
        </TableContainer>
      </Page>
    </Box>
  );
}
