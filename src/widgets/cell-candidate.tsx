import React from 'react';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { ReactWidget } from '@jupyterlab/ui-components';
import { ICellCandidateWidget } from '../extensions/cellmanager';
import {
  CellCandidateOverlay,
  ResultAppliedSignal
} from '../components/result/overlay';
import { Signal } from '@lumino/signaling';
import { ResultCandidate } from '../components/result/overlay';
import { CellLocation } from '../components/cell-location';
import { ResultEntity } from '../components/result/result';

class CellCandidateWidgetImpl implements ICellCandidateWidget {
  private cell: Cell;

  private widget: ReactWidget;

  private resultChangedSignal = new Signal<this, ResultCandidate>(this);

  constructor(
    notebookTracker: INotebookTracker,
    notebook: NotebookPanel,
    cell: Cell,
    resultAppliedSignal: ResultAppliedSignal
  ) {
    this.cell = cell;
    if (!notebook.content.model) {
      throw new Error('No notebook model');
    }
    this.widget = ReactWidget.create(
      <CellCandidateOverlay
        notebookTracker={notebookTracker}
        notebook={notebook.content.model}
        cell={cell}
        resultChangedSignal={this.resultChangedSignal}
        resultAppliedSignal={resultAppliedSignal}
      />
    );
    this.widget.addClass('nbsearch-cell-candidate');
  }

  setResult(location: CellLocation, result: ResultEntity): void {
    this.resultChangedSignal.emit({
      location: location,
      result: result
    });
    const offset = 0;
    let top = undefined;
    let bottom = undefined;
    if (location === CellLocation.CURRENT) {
      top = 0;
    } else if (
      location === CellLocation.PREVIOUS ||
      location === CellLocation.PREVIOUS_SECTION ||
      location === CellLocation.PREVIOUS_NOTEBOOK
    ) {
      bottom = this.cell.node.getBoundingClientRect().height;
    } else if (
      location === CellLocation.NEXT ||
      location === CellLocation.NEXT_SECTION ||
      location === CellLocation.NEXT_NOTEBOOK
    ) {
      top = this.cell.node.getBoundingClientRect().height;
    }
    const styles = [];
    if (top !== undefined) {
      styles.push(`top: ${top - offset}px`);
    }
    if (bottom !== undefined) {
      styles.push(`bottom: ${bottom - offset}px`);
    }
    this.widget.node.setAttribute('style', styles.join(';'));
  }

  getWidget(): ReactWidget {
    return this.widget;
  }
}

export function buildCellCandidateWidget(
  notebookTracker: INotebookTracker,
  notebook: NotebookPanel,
  cell: Cell,
  resultAppliedSignal: ResultAppliedSignal
) {
  return new CellCandidateWidgetImpl(
    notebookTracker,
    notebook,
    cell,
    resultAppliedSignal
  );
}
