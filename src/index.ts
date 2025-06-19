import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

import { buildTreeWidget } from './widgets/tree-search';
import { buildCellWidget } from './widgets/cell-search';
import { Platform, PlatformType, getPlatform } from './widgets/platform';
import { ToolbarExtension } from './extensions/toolbar';
import { CellExtension } from './extensions/cell';
import { NotebookManager } from './extensions/cellmanager';
import { createMagicSearchWidget } from './widgets/magic-search';

/**
 * Find the CodeCell that contains the magic command by cell content
 */
function findCodeCellByCellContent(
  cellHeader: string,
  cellContent: string,
  notebookTracker: INotebookTracker
): CodeCell | undefined {
  if (!cellContent || !notebookTracker.currentWidget) {
    return undefined;
  }
  const notebookPanel = notebookTracker.currentWidget;
  if (!notebookPanel) {
    return undefined;
  }
  const notebook = notebookPanel.content;
  for (let i = 0; i < notebook.widgets.length; i++) {
    const cellWidget = notebook.widgets[i];
    if (cellWidget instanceof CodeCell) {
      const codeCell = cellWidget as CodeCell;
      const source = codeCell.model.sharedModel.getSource();
      const wholeCellContent = cellHeader + '\n' + cellContent;
      // Check if this cell contains the exact content
      if (source.trim() === wholeCellContent.trim()) {
        return codeCell;
      }
    }
  }

  return undefined;
}

async function initialize(
  app: JupyterFrontEnd,
  settingRegistry: ISettingRegistry,
  id: string
) {
  const settings = await settingRegistry.load(id);
  const platform = await getPlatform(app);
  return { platform, settings };
}

function initWidgets(
  app: JupyterFrontEnd,
  platform: Platform,
  documents: IDocumentManager,
  notebookTracker: INotebookTracker,
  settings: ISettingRegistry.ISettings,
  notebookManager: NotebookManager
) {
  if (platform.type !== PlatformType.JUPYTER_NOTEBOOK7_TREE) {
    app.shell.add(
      buildCellWidget(documents, notebookTracker, notebookManager),
      'right',
      {
        rank: 2000
      }
    );
  }
  if (platform.type === PlatformType.JUPYTER_LAB_OR_NOTEBOOK7_NOTEBOOK) {
    app.shell.add(buildTreeWidget(documents, false), 'left', { rank: 2000 });
  } else if (platform.type === PlatformType.JUPYTER_NOTEBOOK7_TREE) {
    const { notebook7TreePanels } = platform;
    if (!notebook7TreePanels) {
      throw new Error('Failed to get notebook7TreePanels');
    }
    notebook7TreePanels.tree.addWidget(buildTreeWidget(documents, true));
  }
}

/**
 * Initialization data for the nbsearch extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nbsearch:plugin',
  description: 'NBSearch Jupyter Extension',
  autoStart: true,
  requires: [ISettingRegistry, IDocumentManager, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry,
    documents: IDocumentManager,
    notebookTracker: INotebookTracker
  ) => {
    console.log('JupyterLab extension nbsearch is activated!');
    const notebookManager = new NotebookManager();
    app.docRegistry.addWidgetExtension('Notebook', new ToolbarExtension(app));
    app.docRegistry.addWidgetExtension(
      'Notebook',
      new CellExtension(notebookTracker, notebookManager)
    );

    // Add command for magic-triggered search
    app.commands.addCommand('nbsearch:magic-search', {
      label: 'NBSearch Magic Search',
      execute: (args: any) => {
        const { keyword, cellHeader, cellContent } = args;
        console.log(
          'Executing NBSearch magic search with keyword:',
          keyword,
          'cellHeader:',
          cellHeader,
          'cellContent:',
          cellContent
        );

        // Find the CodeCell that contains the magic command by cell content
        const codeCell = findCodeCellByCellContent(
          cellHeader,
          cellContent,
          notebookTracker
        );
        if (!codeCell) {
          console.error('No CodeCell found for the given cell content.');
          return;
        }

        createMagicSearchWidget(
          documents,
          notebookTracker,
          notebookManager,
          keyword,
          codeCell
        );
      }
    });

    initialize(app, settingRegistry, plugin.id)
      .then(({ platform, settings }) => {
        initWidgets(
          app,
          platform,
          documents,
          notebookTracker,
          settings,
          notebookManager
        );
      })
      .catch(reason => {
        console.error('Failed to load settings for nbsearch.', reason);
      });
  }
};

export default plugin;
