import React, { ChangeEvent, useCallback } from 'react';
import { Box, TextField } from '@mui/material';


export type SolrQueryProps = {
  query?: string;
  onChange?: (query: string | null) => void;
};


export function SolrQuery(props: SolrQueryProps): JSX.Element {
  const { query, onChange } = props;
  const changed = useCallback((event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!onChange) {
      return;
    }
    const query = event.target.value.trim();
    if (!query) {
      onChange(null);
      return;
    }
    onChange(query);
  }, [onChange]);
  return <Box>
    <TextField
      id='solr-query'
      aria-describedby='solr-query-helper-text'
      label='Solr Query'
      helperText='Solr Query: e.g. *'
      fullWidth={true}
      defaultValue={query}
      onChange={changed}
    />
  </Box>;
}