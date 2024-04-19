import React, { ChangeEvent, useCallback } from 'react';
import { Box, TextField } from '@mui/material';
import { SolrQuery } from './base';

export type RawSolrQueryProps = {
  query?: string;
  onChange?: (query: SolrQuery) => void;
};

export function RawSolrQuery(props: RawSolrQueryProps): JSX.Element {
  const { query, onChange } = props;
  const changed = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (!onChange) {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
        onChange({
          queryString: '_text_:*'
        });
        return;
      }
      onChange({
        queryString: query
      });
    },
    [onChange]
  );
  return (
    <Box>
      <TextField
        id="solr-query"
        aria-describedby="solr-query-helper-text"
        label="Solr Query"
        helperText="Solr Query: e.g. *"
        fullWidth={true}
        defaultValue={query}
        onChange={changed}
      />
    </Box>
  );
}
