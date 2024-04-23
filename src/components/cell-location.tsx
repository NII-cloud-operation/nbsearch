import React from 'react';
import { Cell } from '@jupyterlab/cells';
import { Box, Select, MenuItem } from '@mui/material';

export enum CellLocation {
  CURRENT = 'current',
  NEXT = 'next',
  PREVIOUS = 'previous',
  NEXT_SECTION = 'next-section',
  PREVIOUS_SECTION = 'previous-section',
  NEXT_NOTEBOOK = 'next-notebook',
  PREVIOUS_NOTEBOOK = 'previous-notebook'
}

function cellLocationToLabel(location: CellLocation): string {
  switch (location) {
    case CellLocation.CURRENT:
      return 'Current cell';
    case CellLocation.NEXT:
      return 'Subsequent cell';
    case CellLocation.PREVIOUS:
      return 'Preceding cell';
    case CellLocation.NEXT_SECTION:
      return 'Subsequent cells(in section)';
    case CellLocation.PREVIOUS_SECTION:
      return 'Preceding cells(in section)';
    case CellLocation.NEXT_NOTEBOOK:
      return 'Subsequent cells(in notebook)';
    case CellLocation.PREVIOUS_NOTEBOOK:
      return 'Preceding cells(in notebook)';
  }
}

export type CellLocationSearchQuery = {
  lc_cell_meme__current: string | null;
  lc_cell_meme__next: string | null;
  lc_cell_meme__previous: string | null;
  lc_cell_memes__next__in_section: string | null;
  lc_cell_memes__previous__in_section: string | null;
  lc_cell_memes__next__in_notebook: string | null;
  lc_cell_memes__previous__in_notebook: string | null;
};

export type LCCellMeme = {
  current: string;
  next?: string;
  previous?: string;
};

export type LCCellMemeMetadata = {
  lc_cell_meme: LCCellMeme;
};

export function getSearchQueryForLocation(
  targetCell: Cell,
  searchFor: CellLocation
): CellLocationSearchQuery {
  const lastSearchContext: CellLocationSearchQuery = {
    lc_cell_meme__current: null,
    lc_cell_meme__next: null,
    lc_cell_meme__previous: null,
    lc_cell_memes__next__in_section: null,
    lc_cell_memes__previous__in_section: null,
    lc_cell_memes__next__in_notebook: null,
    lc_cell_memes__previous__in_notebook: null
  };
  const metadata = targetCell.model.metadata as LCCellMemeMetadata;
  lastSearchContext.lc_cell_meme__current = null;
  lastSearchContext.lc_cell_meme__next = null;
  lastSearchContext.lc_cell_meme__previous = null;
  lastSearchContext.lc_cell_memes__next__in_section = null;
  lastSearchContext.lc_cell_memes__previous__in_section = null;
  lastSearchContext.lc_cell_memes__next__in_notebook = null;
  lastSearchContext.lc_cell_memes__previous__in_notebook = null;
  if (searchFor === 'current') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_meme__current = metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'next') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_meme__previous = metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'previous') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_meme__next = metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'next-section') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_memes__previous__in_section =
        metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'previous-section') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_memes__next__in_section =
        metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'next-notebook') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_memes__previous__in_notebook =
        metadata.lc_cell_meme.current;
    }
  } else if (searchFor === 'previous-notebook') {
    if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
      lastSearchContext.lc_cell_memes__next__in_notebook =
        metadata.lc_cell_meme.current;
    }
  }
  return lastSearchContext;
}

export type CellLocationSelectorProps = {
  targetCell?: Cell;
  onSelected: (location: CellLocation) => void;
  defaultLocation?: CellLocation;
};

export function CellLocationSelector({
  targetCell,
  onSelected,
  defaultLocation
}: CellLocationSelectorProps) {
  if (!targetCell) {
    return null;
  }
  return (
    <Box className="nbsearch-search-for">
      <div className="nbsearch-search-for-label">Search for:</div>
      <Select
        id="nbsearch-search-for"
        onChange={e => {
          onSelected(e.target.value as CellLocation);
        }}
        defaultValue={defaultLocation}
      >
        {[
          CellLocation.CURRENT,
          CellLocation.NEXT,
          CellLocation.PREVIOUS,
          CellLocation.NEXT_SECTION,
          CellLocation.PREVIOUS_SECTION,
          CellLocation.NEXT_NOTEBOOK,
          CellLocation.PREVIOUS_NOTEBOOK
        ].map(location => (
          <MenuItem key={location} value={location}>
            {cellLocationToLabel(location)}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
