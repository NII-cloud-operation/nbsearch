import { Box } from '@mui/material';
import React, { ReactNode, useMemo } from 'react';

import { PageControl, PageQuery } from './page-control';

export type PageProps = {
  start?: number;
  limit?: number;
  numFound?: number;
  onPageChange?: (query: PageQuery) => void;
  children: ReactNode;
};

export function Page({
  start,
  limit,
  numFound,
  onPageChange,
  children
}: PageProps) {
  const found = useMemo(
    () => numFound !== undefined && numFound > 0,
    [numFound]
  );
  return (
    <Box>
      {start !== undefined && limit !== undefined && found && (
        <PageControl
          start={start}
          limit={limit}
          numFound={numFound || 0}
          onPageChange={onPageChange}
        />
      )}
      {children}
      {start !== undefined && limit !== undefined && found && (
        <PageControl
          start={start}
          limit={limit}
          numFound={numFound || 0}
          onPageChange={onPageChange}
        />
      )}
    </Box>
  );
}
