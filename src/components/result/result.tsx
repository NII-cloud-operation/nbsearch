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
  Source = 'source__markdown|source__code',
  EstimatedModifiedTime = 'estimated_mtime',
  CurrentMeme = 'lc_notebook_meme__current',
  SignatureNotebookPath = 'signature_notebook_path',
  SourceCode = 'source__code',
  SourceMarkdown = 'source__markdown',
  SourceMarkdownTODO = 'source__markdown__todo',
  SourceMarkdownHeading = 'source__markdown__heading',
  SourceMarkdownURL = 'source__markdown__url',
  SourceMarkdownCode = 'source__markdown__code',
  Stdout = 'outputs__stdout',
  Stderr = 'outputs__stderr',
  ResultPlain = 'outputs__result_plain',
  ResultHTML = 'outputs__result_html'
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
  notebook_filename?: string;
  notebook_owner?: string;
  notebook_server?: string;
  notebook_id?: string;
  notebook_mtime?: string;
  notebook_atime?: string;
  notebook_ctime?: string;
  cell_type?: string;
  lc_cell_meme__current?: string;
  lc_cell_meme__next?: string;
  source__markdown?: string;
  source__code?: string;
  estimated_mtime?: string;
};

export type StoredColumnId = keyof ResultEntity;

export type ResultProps = {
  columns: (StoredColumnId | StoredColumnId[])[];
  data: ResultEntity;
  onSelect?: (result: ResultEntity) => void;
  maxLength?: number;
};

function hasLink(column: StoredColumnId | StoredColumnId[]): boolean {
  if (Array.isArray(column)) {
    return column.some(c => hasLink(c));
  }
  return (
    column === 'filename' ||
    column === 'source__markdown' ||
    column === 'source__code'
  );
}

function getValue(
  data: ResultEntity,
  column: StoredColumnId | StoredColumnId[]
): string | undefined {
  if (Array.isArray(column)) {
    const value = column.find(c => data[c] !== undefined);
    if (value === undefined) {
      return undefined;
    }
    return data[value];
  }
  return data[column];
}

function renderValue(
  data: ResultEntity,
  column: StoredColumnId | StoredColumnId[],
  onSelect?: (result: ResultEntity) => void,
  maxLength?: number
): JSX.Element {
  let value = getValue(data, column);
  if (value === undefined) {
    return <div />;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    value = `${value.substring(0, maxLength - 3)}...`;
  }
  if (hasLink(column) && onSelect) {
    return (
      <Link component="button" onClick={() => onSelect(data)}>
        {value}
      </Link>
    );
  }
  return <div>{value}</div>;
}

export function Result({ columns, data, onSelect, maxLength }: ResultProps) {
  return (
    <TableRow>
      {columns.map(column => (
        <TableCell>{renderValue(data, column, onSelect, maxLength)}</TableCell>
      ))}
    </TableRow>
  );
}
