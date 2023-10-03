import React from 'react';
import { TableRow, TableCell, Link } from '@mui/material';


export enum IndexedColumnId {
  FullText = '_text_',
  Cells = 'source',
  Outputs = 'outputs',
  CellMemes = 'lc_cell_memes',
  Path = 'filename',
  Server = 'signature_server_url',
  Owner = 'owner',
  Modified = 'mtime',
  Executed = 'lc_cell_meme__execution_end_time',
  OperationNote = 'source__markdown__operation_note',
  NumberOfHeaders = 'source__markdown__heading_count',
}


export type ResultEntity = {
  id: string;
  atime?: string;
  ctime?: string;
  mtime?: string;
  owner?: string;
  filename: string;
  lc_cell_memes?: string;
  lc_notebook_meme__current?: string;
  lc_cell_meme__execution_end_time?: string;
  signature_id?: string;
  signature_notebook_path?: string;
  signature_server_url?: string;
  source__markdown__heading?: string;
  source__markdown__heading_1?: string;
  source__markdown__heading_2?: string;
  source__markdown__heading_3?: string;
  source__markdown__heading_count?: string;
  source__markdown__url?: string;
  source__markdown__operation_note?: string;
  _version_: string;
}


export type StoredColumnId = keyof ResultEntity;


export type ResultProps = {
  columns: StoredColumnId[];
  data: ResultEntity;
  onSelect?: (result: ResultEntity) => void;
};

function renderValue(
  data: ResultEntity,
  column: StoredColumnId,
  onSelect?: (result: ResultEntity) => void,
): JSX.Element {
  const value = data[column];
  if (column === 'filename' && onSelect) {
    return <Link
      component='button'
      onClick={() => onSelect(data)}
    >
      {value}
    </Link>
  }
  return <div>{value || ''}</div>;
}

export function Result(props: ResultProps) {
  const {
    columns,
    data,
    onSelect,
  } = props;

  return <TableRow>
    {columns.map((column) => (
      <TableCell>{renderValue(data, column, onSelect)}</TableCell>
    ))}
  </TableRow>
}