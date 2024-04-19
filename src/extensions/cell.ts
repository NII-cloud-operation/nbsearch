import { Widget } from '@lumino/widgets';
import {
  INotebookModel,
  INotebookTracker,
  Notebook,
  NotebookPanel
} from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';
import { Cell } from '@jupyterlab/cells';
import { buildCellCandidateWidget } from '../widgets/cell-candidate';
import { NotebookManager } from './cellmanager';
import { Signal } from '@lumino/signaling';
import { InsertedCell } from '../components/result/overlay';

export class CellExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  private notebookTracker: INotebookTracker;

  private notebookManager: NotebookManager;

  private lastInsertedCell: InsertedCell | null = null;

  private resultAppliedSignal: Signal<object, InsertedCell> = new Signal<
    object,
    InsertedCell
  >(this);

  constructor(
    notebookTracker: INotebookTracker,
    notebookManager: NotebookManager
  ) {
    this.notebookTracker = notebookTracker;
    this.notebookManager = notebookManager;
  }

  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): void | IDisposable {
    panel.content.model?.cells.changed.connect((_, change) => {
      if (change.type === 'add') {
        change.newValues.forEach(cellModel => {
          const cell = getCellByModelId(panel.content, cellModel.id);
          if (!cell) {
            return;
          }
          cell.inViewportChanged.connect((_, isAttached) => {
            if (!isAttached) {
              return;
            }
            if (!panel.content.model) {
              throw new Error('No notebook model');
            }
            if (
              this.lastInsertedCell !== null &&
              cellModel.id === this.lastInsertedCell.id
            ) {
              this.select(panel, cell);
              this.lastInsertedCell = null;
            } else {
              this.resultAppliedSignal.connect((_, insertedCell) => {
                if (insertedCell.id !== cellModel.id) {
                  return;
                }
                this.select(panel, cell);
              });
            }
            const w = this.initCell(panel, cell as Cell);
            this.notebookManager.registerCell(
              panel.content.id,
              cellModel.id,
              w
            );
          });
        });
      }
    });
    return new DisposableDelegate(() => {});
  }

  private select(panel: NotebookPanel, cell: Cell) {
    panel.content.scrollToCell(cell);
    if (!cell.editor) {
      console.warn('No editor in cell');
      return;
    }
    cell.editor.focus();
  }

  private initCell(notebook: NotebookPanel, cell: Cell) {
    const w = buildCellCandidateWidget(this.notebookTracker, notebook, cell, {
      emit: insertedCell => {
        this.lastInsertedCell = insertedCell;
        this.resultAppliedSignal.emit(insertedCell);
      }
    });
    Widget.attach(w.getWidget(), cell.node);
    return w;
  }
}

function getCellByModelId(notebook: Notebook, cellModelId: string) {
  return notebook.widgets.find(c => c.model.id === cellModelId);
}
