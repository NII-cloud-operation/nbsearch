import { Box } from '@mui/material';
import React, { ReactNode } from 'react';

import { PageControl, PageQuery } from './page-control';

export type PageProps = {
  start?: number;
  limit?: number;
  numFound?: number;
  onPageChange?: (query: PageQuery) => void;
  children: ReactNode;
};

export function Page(props: PageProps) {
  const { start, limit, numFound, onPageChange, children } = props;
  return (
    <Box>
      {start !== undefined && limit !== undefined && numFound !== undefined && (
        <PageControl
          start={start}
          limit={limit}
          numFound={numFound}
          onPageChange={onPageChange}
        />
      )}
      {children}
      {start !== undefined && limit !== undefined && numFound !== undefined && (
        <PageControl
          start={start}
          limit={limit}
          numFound={numFound}
          onPageChange={onPageChange}
        />
      )}
    </Box>
  );
}
