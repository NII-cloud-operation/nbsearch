import React, { useState, useCallback } from 'react';
import { Typography, Table, TableHead, TableBody, TableRow, TableCell, Link } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import { IndexedColumnId, StoredColumnId, ResultEntity, Result } from './result';


type Column = {
  id: IndexedColumnId;
  label: string;
  value: StoredColumnId;
};


export enum SortOrder {
  Ascending,
  Descending,
};


export type SortQuery = {
  column: IndexedColumnId;
  order: SortOrder;
};


const COLUMNS: Column[] = [
  {
    id: IndexedColumnId.Path,
    label: 'Path',
    value: 'filename',
  },
  {
    id: IndexedColumnId.Server,
    label: 'Server',
    value: 'signature_server_url',
  },
  {
    id: IndexedColumnId.Owner,
    label: 'Owner',
    value: 'owner',
  },
  {
    id: IndexedColumnId.Modified,
    label: 'Modified',
    value: 'mtime',
  },
  {
    id: IndexedColumnId.Executed,
    label: 'Executed',
    value: 'lc_cell_meme__execution_end_time',
  },
  {
    id: IndexedColumnId.OperationNote,
    label: 'Operation Note',
    value: 'source__markdown__operation_note',
  },
  {
    id: IndexedColumnId.NumberOfHeaders,
    label: '# of Headers',
    value: 'source__markdown__heading_count',
  },
];


export type ResultsProps = {
  data?: ResultEntity[];
  onColumnSort?: (key: SortQuery) => void;
  onResultSelect?: (data: ResultEntity) => void;
};


function renderColumn(
  column: Column,
  sortHandler: (key: SortQuery) => void,
  sortQuery: SortQuery | null,
) {
  return <Link
    component='button'
    onClick={() => {
      let order = SortOrder.Ascending;
      if (sortQuery && sortQuery.column === column.id) {
        if (sortQuery.order === SortOrder.Ascending) {
          order = SortOrder.Descending;
        }
      }
      sortHandler({
        column: column.id,
        order,
      });
    }}
  >
    <div style={{
      display: 'flex',
    }}>
      {column.label}
      {sortQuery?.column === column.id && sortQuery.order === SortOrder.Ascending &&
        <KeyboardArrowUpIcon />}
      {sortQuery?.column === column.id && sortQuery.order === SortOrder.Descending &&
        <KeyboardArrowDownIcon />}
    </div>
  </Link>;
}


export function Results(props: ResultsProps) {
  const { data, onColumnSort, onResultSelect } = props;
  if (!data || data.length === 0) {
    return <Typography>
      No results
    </Typography>
  }

  const [sortQuery, setSortQuery] = useState<SortQuery | null>(null);
  const sorted = useCallback((key: SortQuery) => {
    setSortQuery(key);
    if (!onColumnSort) {
      return;
    }
    onColumnSort(key);
  }, [onColumnSort])

  return <Table>
    <TableHead>
      <TableRow>
        {COLUMNS.map((column) => (
          <TableCell>{renderColumn(column, sorted, sortQuery)}</TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {data.map((result) => (
        <Result
          onSelect={onResultSelect}
          columns={COLUMNS.map((c) => c.value)}
          data={result}
        />
      ))}
    </TableBody>
  </Table>
}