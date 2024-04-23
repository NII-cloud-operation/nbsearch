import { JupyterFrontEnd } from '@jupyterlab/application';

import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { DisposableDelegate, IDisposable } from '@lumino/disposable';
import { ToolbarButton } from '@jupyterlab/apputils';
import { CELL_SEARCH_WIDGET_ID } from '../widgets/cell-search';
import { searchIcon } from '../widgets/icons';

const BUTTON_LOCATION = 11;

export class ToolbarExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  private app: JupyterFrontEnd;
  constructor(app: JupyterFrontEnd) {
    this.app = app;
  }

  createNew(
    widget: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): void | IDisposable {
    let button: ToolbarButton | null = null;
    button = new ToolbarButton({
      className: 'nbsearch-cell-toggle',
      icon: searchIcon,
      tooltip: 'show cell search',
      onClick: () => {
        if (!widget.model) {
          throw new Error('No notebook model');
        }
        if (!button) {
          throw new Error('No button');
        }
        this.app.shell.activateById(CELL_SEARCH_WIDGET_ID);
      }
    });
    widget.toolbar.insertItem(BUTTON_LOCATION, 'nbsearch-cell-toggle', button);
    return new DisposableDelegate(() => {
      if (!button) {
        return;
      }
      button.dispose();
    });
  }
}
