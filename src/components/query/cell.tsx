import React, { useCallback, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { FieldsQuery, CompositeQuery } from './fields';
import { LazySolrQuery, SolrQuery } from './base';
import { RawSolrQuery } from './solr';
import { Cell, isCodeCellModel, isMarkdownCellModel } from '@jupyterlab/cells';
import {
  CellLocation,
  getSearchQueryForLocation,
  CellLocationSearchQuery
} from '../cell-location';
import { IndexedColumnId } from '../result/result';

enum TabIndex {
  Cell,
  Fields,
  Solr
}

type TabPanelProps = {
  children?: React.ReactNode;
  id: TabIndex;
  value: TabIndex;
};

function TabPanel(props: TabPanelProps): JSX.Element {
  const { value, id, children } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== id}
      id={`simple-tabpanel-${id}`}
      aria-labelledby={`simple-tab-${id}`}
    >
      {value === id && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type CellProps = {
  targetCell: Cell;
  location: CellLocation;
  onChange?: (query: LazySolrQuery) => void;
};

export enum CellSearchMode {
  ByMEME = 'by-meme',
  ByContent = 'by-content'
}

export type CellSearchQuery = CellLocationSearchQuery & {
  cell_type: string;
  source: string[] | string;
};

function join(target: string[] | string): string {
  if (Array.isArray(target)) {
    return target.join(' ');
  }
  return target;
}

export function getDefaultSolrQuery(searchContext: CellSearchQuery) {
  if (searchContext.lc_cell_meme__previous) {
    return `lc_cell_meme__previous:${searchContext.lc_cell_meme__previous}`;
  } else if (searchContext.lc_cell_meme__next) {
    return `lc_cell_meme__next:${searchContext.lc_cell_meme__next}`;
  } else if (searchContext.lc_cell_meme__current) {
    return `cell_type:${searchContext.cell_type} AND lc_cell_meme__current:${searchContext.lc_cell_meme__current}`;
  }
  const source = join(searchContext.source).replace(/\n/g, ' ');
  const normalizedSource = source.trim().length > 0 ? source : '*';
  return `cell_type:${searchContext.cell_type} AND source__${searchContext.cell_type}:${normalizedSource}`;
}

export function getCellSearchQuery(
  targetCell: Cell,
  locationSearchContext: CellLocationSearchQuery
) {
  const searchContext = Object.assign(
    {
      cell_type: targetCell.model.type,
      source: ''
    },
    locationSearchContext
  ) as CellSearchQuery;
  if (
    isCodeCellModel(targetCell.model) ||
    isMarkdownCellModel(targetCell.model)
  ) {
    searchContext.source = targetCell.model.toJSON().source;
  }
  return searchContext;
}

export function getSolrQueryFromCell(
  cell: Cell,
  mode: CellSearchMode,
  location: CellLocation
): SolrQuery {
  if (mode === CellSearchMode.ByContent) {
    const source =
      isMarkdownCellModel(cell.model) || isCodeCellModel(cell.model)
        ? cell.model.toJSON().source
        : '';
    return {
      queryString: Array.isArray(source) ? source.join(' ') : source
    };
  }
  const queryString = getDefaultSolrQuery(
    getCellSearchQuery(cell, getSearchQueryForLocation(cell, location))
  );
  return {
    queryString,
    q_op: 'OR'
  };
}

export function CellQuery(props: CellProps): JSX.Element {
  const { targetCell, location, onChange } = props;
  const modeChanged = useCallback(
    (mode: CellSearchMode) => {
      if (!onChange) {
        return;
      }
      onChange({
        get: ({ cell: contextCell }) => {
          if (!contextCell) {
            throw new Error('Context Cell is not provided');
          }
          return getSolrQueryFromCell(contextCell, mode, location);
        }
      });
    },
    [targetCell, onChange]
  );
  return (
    <Box>
      <Select
        defaultValue={CellSearchMode.ByMEME}
        onChange={(event: SelectChangeEvent) =>
          modeChanged(event.target.value as CellSearchMode)
        }
        sx={{ marginRight: '0.5em' }}
      >
        <MenuItem value={CellSearchMode.ByMEME}>Search by MEME</MenuItem>
        <MenuItem value={CellSearchMode.ByContent}>Search by content</MenuItem>
      </Select>
    </Box>
  );
}

class LazyWrappedQuery implements LazySolrQuery {
  constructor(private query: SolrQuery) {}
  get(): SolrQuery {
    return Object.assign({}, this.query);
  }
}

export type QueryProps = {
  targetCell: Cell;
  location: CellLocation;
  onChange?: (query: LazySolrQuery, compositeQuery?: CompositeQuery) => void;
  onSearch?: () => void;
  fields?: IndexedColumnId[];
};

export function Query({
  onChange,
  onSearch,
  targetCell,
  location,
  fields
}: QueryProps): JSX.Element {
  const [solrQuery, setSolrQuery] = useState<SolrQuery>({
    queryString: '_text_:*'
  });
  const [fieldsQuery, setFieldsQuery] = useState<SolrQuery>({
    queryString: '_text_:*'
  });
  const [fieldsCompositeQuery, setFieldsCompositeQuery] = useState<
    CompositeQuery | undefined
  >(undefined);
  const [cellQuery, setCellQuery] = useState<LazySolrQuery>({
    get: ({ cell: contextCell }) => {
      if (!contextCell) {
        throw new Error('Context Cell is not provided');
      }
      return getSolrQueryFromCell(
        contextCell,
        CellSearchMode.ByMEME,
        CellLocation.CURRENT
      );
    }
  });
  const [tabIndex, setTabIndex] = useState<TabIndex>(TabIndex.Cell);

  const cellChanged = useCallback(
    (query: LazySolrQuery) => {
      setCellQuery(query);
      if (!onChange) {
        return;
      }
      onChange(query);
    },
    [onChange]
  );
  const solrChanged = useCallback(
    (query: SolrQuery) => {
      setSolrQuery(query);
      if (!onChange) {
        return;
      }
      onChange(new LazyWrappedQuery(query));
    },
    [onChange]
  );
  const fieldsChanged = useCallback(
    (query: SolrQuery, compositeQuery: CompositeQuery) => {
      setFieldsQuery(query);
      setFieldsCompositeQuery(compositeQuery);
      if (!onChange) {
        return;
      }
      onChange(new LazyWrappedQuery(query), compositeQuery);
    },
    [onChange]
  );
  const tabChanged = useCallback(
    (event: React.SyntheticEvent, tabIndex: any) => {
      const index = tabIndex as TabIndex;
      setTabIndex(index);
      if (!onChange) {
        return;
      }
      onChange(
        index === TabIndex.Cell
          ? cellQuery
          : index === TabIndex.Fields
          ? new LazyWrappedQuery(fieldsQuery)
          : new LazyWrappedQuery(solrQuery),
        index === TabIndex.Fields ? fieldsCompositeQuery : undefined
      );
    },
    [fieldsQuery, solrQuery, onChange]
  );

  return (
    <Box>
      <Tabs value={tabIndex} onChange={tabChanged}>
        <Tab
          value={TabIndex.Cell}
          label="Search by cell"
          id={`simple-tab-${TabIndex.Cell}`}
          aria-controls={`simple-tabpanel-${TabIndex.Cell}`}
        />
        <Tab
          value={TabIndex.Fields}
          label="Search by fields"
          id={`simple-tab-${TabIndex.Fields}`}
          aria-controls={`simple-tabpanel-${TabIndex.Fields}`}
        />
        <Tab
          value={TabIndex.Solr}
          label="Solr query"
          id={`simple-tab-${TabIndex.Solr}`}
          aria-controls={`simple-tabpanel-${TabIndex.Solr}`}
        />
      </Tabs>
      <TabPanel id={TabIndex.Cell} value={tabIndex}>
        <CellQuery
          targetCell={targetCell}
          location={location}
          onChange={cellChanged}
        />
      </TabPanel>
      <TabPanel id={TabIndex.Fields} value={tabIndex}>
        <FieldsQuery
          fields={fields}
          onChange={fieldsChanged}
          onSearch={onSearch}
          value={fieldsCompositeQuery}
        />
      </TabPanel>
      <TabPanel id={TabIndex.Solr} value={tabIndex}>
        <RawSolrQuery onChange={solrChanged} query={solrQuery.queryString} />
      </TabPanel>
    </Box>
  );
}
