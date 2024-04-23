import React from 'react';

import { Box, Link } from '@mui/material';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type PageQuery = {
  start: number;
  limit: number;
};

export type PageControlProps = {
  start: number;
  limit: number;
  numFound: number;
  onPageChange?: (query: PageQuery) => void;
};

export function PageControl(props: PageControlProps): JSX.Element {
  const { start, limit, numFound, onPageChange } = props;

  const pageNum = `${start}-${Math.min(start + limit, numFound)} / ${numFound}`;
  return (
    <Box>
      {start > 0 && onPageChange && (
        <Link
          component="button"
          onClick={() => {
            onPageChange({
              start: Math.max(0, start - limit),
              limit
            });
          }}
        >
          <ChevronLeftIcon />
        </Link>
      )}
      <span>{pageNum}</span>
      {start + limit < numFound && onPageChange && (
        <Link
          component="button"
          onClick={() => {
            onPageChange({
              start: Math.max(0, start + limit),
              limit
            });
          }}
        >
          <ChevronRightIcon />
        </Link>
      )}
    </Box>
  );
}
