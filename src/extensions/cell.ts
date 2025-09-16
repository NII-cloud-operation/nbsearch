import { Widget } from '@lumino/widgets';
import {
  INotebookModel,
  INotebookTracker,
  Notebook,
  NotebookPanel
} from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';
import { Cell, ICellModel, MarkdownCell } from '@jupyterlab/cells';
import { buildCellCandidateWidget } from '../widgets/cell-candidate';
import { NotebookManager } from './cellmanager';
import { Signal } from '@lumino/signaling';
import { InsertedCell } from '../components/result/overlay';
import { MarkdownIntervention, ISearchHandler } from './markdown-intervention';

export class CellExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  private notebookTracker: INotebookTracker;

  private notebookManager: NotebookManager;

  private markdownIntervention: MarkdownIntervention;

  private lastInsertedCell: InsertedCell | null = null;

  private resultAppliedSignal: Signal<object, InsertedCell> = new Signal<
    object,
    InsertedCell
  >(this);

  private initializedCells = new Set<string>();

  constructor(
    notebookTracker: INotebookTracker,
    notebookManager: NotebookManager
  ) {
    this.notebookTracker = notebookTracker;
    this.notebookManager = notebookManager;
    this.markdownIntervention = new MarkdownIntervention();
  }

  setSearchHandler(searchHandler: ISearchHandler): void {
    this.markdownIntervention.setSearchHandler(searchHandler);
  }

  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): void | IDisposable {
    // Helper function to setup a cell
    const setupCell = (cellModel: ICellModel, retryCount = 0) => {
      const cell = getCellByModelId(panel.content, cellModel.id);
      if (!cell) {
        if (retryCount < 10) {
          // Retry up to 10 times with exponential backoff
          const delay = Math.min(50 * Math.pow(2, retryCount), 1000);
          setTimeout(() => {
            setupCell(cellModel, retryCount + 1);
          }, delay);
        } else {
          console.warn(
            '[nbsearch] Cell widget not found after retries for cellModel:',
            cellModel.id,
            'type:',
            cellModel.type
          );
        }
        return;
      }

      cell.inViewportChanged.connect((_, isAttached) => {
        if (!isAttached) {
          return;
        }
        // Check if cell has already been initialized
        if (this.initializedCells.has(cellModel.id)) {
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
        if (w) {
          this.notebookManager.registerCell(panel.content.id, cellModel.id, w);
          // Mark cell as initialized
          this.initializedCells.add(cellModel.id);
        }
      });

      // If cell is already in viewport, initialize it immediately
      if (cell.inViewport && !this.initializedCells.has(cellModel.id)) {
        const w = this.initCell(panel, cell as Cell);
        if (w) {
          this.notebookManager.registerCell(panel.content.id, cellModel.id, w);
          this.initializedCells.add(cellModel.id);
        }
      }
    };

    // Process existing cells when notebook opens
    if (panel.content.model) {
      for (let i = 0; i < panel.content.model.cells.length; i++) {
        setupCell(panel.content.model.cells.get(i));
      }
    }

    // Handle newly added cells
    panel.content.model?.cells.changed.connect((_, change) => {
      if (change.type === 'add') {
        change.newValues.forEach(cellModel => {
          setupCell(cellModel);
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
    // Check if widget already exists in DOM
    const existingWidget = cell.node.querySelector('.nbsearch-cell-widget');
    if (existingWidget) {
      return null;
    }

    // Initialize Markdown intervention for Markdown cells
    if (cell.model.type === 'markdown') {
      this.markdownIntervention.initMarkdownCell(cell as MarkdownCell);
    }

    const w = buildCellCandidateWidget(this.notebookTracker, notebook, cell, {
      emit: insertedCell => {
        this.lastInsertedCell = insertedCell;
        this.resultAppliedSignal.emit(insertedCell);
      }
    });
    const widget = w.getWidget();
    widget.addClass('nbsearch-cell-widget');
    Widget.attach(widget, cell.node);
    return w;
  }
}

function getCellByModelId(notebook: Notebook, cellModelId: string) {
  return notebook.widgets.find(c => c.model.id === cellModelId);
}
