import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { INotebookModel, INotebookTracker } from '@jupyterlab/notebook';
import {
  Cell,
  ICellModel,
  isCodeCellModel,
  isMarkdownCellModel
} from '@jupyterlab/cells';
import { ISignal } from '@lumino/signaling';
import { CellLocation, LCCellMemeMetadata } from '../cell-location';
import { ResultEntity } from './result';
import { CandidateView } from './candidate';
import { Box } from '@mui/material';
import { showDiffDialog } from '../diff/dialog';

export type ResultCandidate = {
  location: CellLocation;
  result: ResultEntity;
};

export type InsertedCell = {
  id: string;
};

export type ResultAppliedSignal = {
  emit: (insertedCell: InsertedCell) => void;
};

export type CellCandidateOverlayProps = {
  notebookTracker: INotebookTracker;
  notebook: INotebookModel;
  cell: Cell;
  resultChangedSignal: ISignal<object, ResultCandidate>;
  resultAppliedSignal: ResultAppliedSignal;
};

function getCellsAsArray(notebook: INotebookModel): ICellModel[] {
  const cells: ICellModel[] = [];
  for (const cell of notebook.cells) {
    cells.push(cell);
  }
  return cells;
}

function getTargetCell(
  notebook: INotebookModel,
  cell: Cell,
  location: CellLocation
): ICellModel {
  if (location === CellLocation.CURRENT) {
    return cell.model;
  }
  const cells = getCellsAsArray(notebook);
  const index = cells.findIndex(c => c.id === cell.model.id);
  if (index === -1) {
    throw new Error(`Cell not found: ${cell.model.id}`);
  }
  if (
    location === CellLocation.PREVIOUS ||
    location === CellLocation.PREVIOUS_SECTION ||
    location === CellLocation.PREVIOUS_NOTEBOOK
  ) {
    if (index === 0) {
      throw new Error('No previous cell');
    }
    return cells[index - 1];
  }
  if (
    location === CellLocation.NEXT ||
    location === CellLocation.NEXT_SECTION ||
    location === CellLocation.NEXT_NOTEBOOK
  ) {
    if (index === cells.length - 1) {
      throw new Error('No next cell');
    }
    return cells[index + 1];
  }
  throw new Error(`Unsupported location: ${location}`);
}

function getSourceAsMultilineString(cell: ICellModel) {
  if (isCodeCellModel(cell)) {
    return cell.toJSON().source;
  }
  if (isMarkdownCellModel(cell)) {
    return cell.toJSON().source;
  }
  throw new Error(`Unsupported cell type: ${cell.type}`);
}

function getSource(cell: ICellModel) {
  const content = getSourceAsMultilineString(cell);
  if (Array.isArray(content)) {
    return content.join('\n');
  }
  return content;
}

function resultToMetadata(result: ResultEntity): LCCellMemeMetadata {
  return {
    lc_cell_meme: {
      current: result.lc_cell_meme__current || ''
    }
  };
}

export function CellCandidateOverlay({
  notebookTracker,
  notebook,
  cell,
  resultChangedSignal,
  resultAppliedSignal
}: CellCandidateOverlayProps): JSX.Element | null {
  const [result, setResult] = React.useState<ResultCandidate | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const candidateContent = useMemo(() => {
    if (!result) {
      return '';
    }
    const { cell_type, source__code, source__markdown } = result.result;
    if (cell_type === 'code') {
      return source__code || '';
    }
    if (cell_type === 'markdown') {
      return source__markdown || '';
    }
    throw new Error(`Unsupported cell type: ${cell_type}`);
  }, [result]);
  const currentContent = useMemo(() => {
    if (result === null) {
      return '';
    }
    const { location } = result;
    const targetCell = getTargetCell(notebook, cell, location);
    return getSource(targetCell);
  }, [result, cell, notebook]);

  const openDiff = useCallback(() => {
    if (candidateContent === null || currentContent === null) {
      return;
    }
    showDiffDialog(candidateContent, currentContent, 'Diff');
  }, [candidateContent, currentContent]);

  const apply = useCallback(() => {
    if (result === null) {
      return;
    }
    const { location } = result;
    if (location === CellLocation.CURRENT) {
      cell.model.sharedModel.setSource(candidateContent);
      setResult(null);
      return;
    }
    let index = getCellsAsArray(notebook).findIndex(
      c => c.id === cell.model.id
    );
    if (
      location === CellLocation.NEXT ||
      location === CellLocation.NEXT_SECTION ||
      location === CellLocation.NEXT_NOTEBOOK
    ) {
      index++;
    }
    const { result: resultContent } = result;
    if (resultContent.cell_type === undefined) {
      throw new Error('cell_type not defined');
    }
    const source =
      resultContent.cell_type === 'code' ? 'source__code' : 'source__markdown';

    const newCell = {
      cell_type: resultContent.cell_type,
      source: resultContent[source],
      metadata: resultToMetadata(resultContent),
      trusted: true
    };
    const insertedCell = notebook.sharedModel.insertCell(index, newCell);
    setResult(null);
    resultAppliedSignal.emit(insertedCell);
  }, [result, candidateContent, notebook, cell, resultAppliedSignal]);

  useEffect(() => {
    const callback = (sender: object, result: ResultCandidate) => {
      setResult(result);
      setTimeout(() => {
        if (viewRef.current === null) {
          return;
        }
        viewRef.current.scrollIntoView();
      }, 100);
    };
    resultChangedSignal.connect(callback);
    return () => {
      resultChangedSignal.disconnect(callback);
    };
  }, [resultChangedSignal, viewRef]);

  useEffect(() => {
    const callback = () => {
      const { activeCell } = notebookTracker;
      if (activeCell !== null && activeCell.model.id === cell.model.id) {
        return;
      }
      setResult(null);
    };
    notebookTracker.activeCellChanged.connect(callback);
    return () => {
      notebookTracker.activeCellChanged.disconnect(callback);
    };
  }, [notebookTracker, cell]);

  return (
    <Box ref={viewRef}>
      {candidateContent && (
        <CandidateView
          content={candidateContent}
          onDiffOpen={openDiff}
          onApply={apply}
        />
      )}
    </Box>
  );
}
