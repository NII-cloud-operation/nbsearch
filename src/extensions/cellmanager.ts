import { ReactWidget } from '@jupyterlab/ui-components';
import { CellLocation } from '../components/cell-location';
import { ResultEntity } from '../components/result/result';

export interface ICellCandidateWidget {
  setResult(location: CellLocation, result: ResultEntity): void;

  getWidget(): ReactWidget;
}

export class NotebookManager {
  private cellManagers: { [notebookId: string]: CellManager } = {};

  registerCell(notebookId: string, cellId: string, cell: ICellCandidateWidget) {
    if (!this.cellManagers[notebookId]) {
      this.cellManagers[notebookId] = new CellManager();
    }
    this.cellManagers[notebookId].registerCell(cellId, cell);
  }

  findCell(
    notebookId: string,
    cellId: string
  ): ICellCandidateWidget | undefined {
    const cellManager = this.findCellManager(notebookId);
    if (!cellManager) {
      return undefined;
    }
    return cellManager.findCell(cellId);
  }

  findCellManager(notebookId: string): CellManager | undefined {
    return this.cellManagers[notebookId];
  }
}

export class CellManager {
  private widgets: { [key: string]: ICellCandidateWidget } = {};

  registerCell(cellId: string, cell: ICellCandidateWidget) {
    this.widgets[cellId] = cell;
  }

  findCell(cellId: string): ICellCandidateWidget | undefined {
    return this.widgets[cellId];
  }
}
