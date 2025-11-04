import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IDisposable, DisposableDelegate } from '@lumino/disposable';
import { ICellModel, MarkdownCell } from '@jupyterlab/cells';
import { MarkdownIntervention, ISearchHandler } from './markdown-intervention';

export class CellExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  private markdownIntervention: MarkdownIntervention;

  constructor() {
    this.markdownIntervention = new MarkdownIntervention();
  }

  setSearchHandler(searchHandler: ISearchHandler): void {
    this.markdownIntervention.setSearchHandler(searchHandler);
  }

  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): void | IDisposable {
    const setupCell = (cellModel: ICellModel) => {
      if (cellModel.type === 'markdown') {
        const cell = panel.content.widgets.find(
          c => c.model.id === cellModel.id
        );
        if (cell) {
          this.markdownIntervention.initMarkdownCell(cell as MarkdownCell);
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
}
