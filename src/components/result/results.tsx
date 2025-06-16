import React, { useState, useCallback } from 'react';
import {
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Link
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import {
  IndexedColumnId,
  StoredColumnId,
  ResultEntity,
  Result
} from './result';

export type ResultColumn = {
  id: IndexedColumnId;
  label: string;
  value: StoredColumnId | StoredColumnId[];
};

export enum SortOrder {
  Ascending,
  Descending
}

export type SortQuery = {
  column: IndexedColumnId;
  order: SortOrder;
};

export type ResultsProps = {
  data?: ResultEntity[];
  columns: ResultColumn[];
  onColumnSort?: (key: SortQuery) => void;
  onResultSelect?: (data: ResultEntity) => void;
  onResultAdd?: (data: ResultEntity) => void;
  showAddButton?: boolean;
  maxLength?: number;
};

function renderColumn(
  column: ResultColumn,
  sortHandler: (key: SortQuery) => void,
  sortQuery: SortQuery | null
) {
  return (
    <Link
      component="button"
      onClick={() => {
        let order = SortOrder.Ascending;
        if (sortQuery && sortQuery.column === column.id) {
          if (sortQuery.order === SortOrder.Ascending) {
            order = SortOrder.Descending;
          }
        }
        sortHandler({
          column: column.id,
          order
        });
      }}
    >
      <div
        style={{
          display: 'flex'
        }}
      >
        {column.label}
        {sortQuery?.column === column.id &&
          sortQuery.order === SortOrder.Ascending && <KeyboardArrowUpIcon />}
        {sortQuery?.column === column.id &&
          sortQuery.order === SortOrder.Descending && <KeyboardArrowDownIcon />}
      </div>
    </Link>
  );
}

export function Results({
  columns,
  data,
  onColumnSort,
  onResultSelect,
  onResultAdd,
  showAddButton,
  maxLength
}: ResultsProps) {
  if (!data || data.length === 0) {
    return <Typography>No results</Typography>;
  }

  const [sortQuery, setSortQuery] = useState<SortQuery | null>(null);
  const sorted = useCallback(
    (key: SortQuery) => {
      setSortQuery(key);
      if (!onColumnSort) {
        return;
      }
      onColumnSort(key);
    },
    [onColumnSort]
  );

  return (
    <Table className="nbsearch-results-root">
      <TableHead>
        <TableRow>
          {columns.map(column => (
            <TableCell>{renderColumn(column, sorted, sortQuery)}</TableCell>
          ))}
          {showAddButton && <TableCell>Action</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map(result => (
          <Result
            onSelect={onResultSelect}
            onAdd={onResultAdd}
            showAddButton={showAddButton}
            columns={columns.map(c => c.value)}
            data={result}
            maxLength={maxLength}
          />
        ))}
      </TableBody>
    </Table>
  );
}
