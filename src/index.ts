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
import { hasSearchParams } from './utils/url-params';
import { ReactWidget } from '@jupyterlab/apputils';
import { LOG_PREFIX } from './utils/constants';
import { LabSearchHandler } from './handlers/lab-search-handler';
import { Notebook7SearchHandler } from './handlers/notebook7-search-handler';

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
): ReactWidget | null {
  let treeWidget: ReactWidget | null = null;

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
    treeWidget = buildTreeWidget(documents, platform, false);
    app.shell.add(treeWidget, 'left', { rank: 2000 });
  } else if (platform.type === PlatformType.JUPYTER_NOTEBOOK7_TREE) {
    const { notebook7TreePanels } = platform;
    if (!notebook7TreePanels) {
      throw new Error('Failed to get notebook7TreePanels');
    }
    treeWidget = buildTreeWidget(documents, platform, true);
    notebook7TreePanels.tree.addWidget(treeWidget);
  }

  return treeWidget;
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
    const cellExtension = new CellExtension(notebookTracker, notebookManager);

    app.docRegistry.addWidgetExtension('Notebook', new ToolbarExtension(app));
    app.docRegistry.addWidgetExtension('Notebook', cellExtension);

    // Add command for magic-triggered search
    app.commands.addCommand('nbsearch:magic-search', {
      label: 'NBSearch Magic Search',
      execute: (args: any) => {
        const { keyword, cellHeader, cellContent } = args;
        console.log(
          `${LOG_PREFIX} Executing magic search with keyword:`,
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
          console.error(
            `${LOG_PREFIX} No CodeCell found for the given cell content.`
          );
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
        const treeWidget = initWidgets(
          app,
          platform,
          documents,
          notebookTracker,
          settings,
          notebookManager
        );

        // Set up the search handler
        if (platform.type === PlatformType.JUPYTER_LAB_OR_NOTEBOOK7_NOTEBOOK) {
          // Check if running in Notebook 7 or JupyterLab
          if (app.name === 'Jupyter Notebook') {
            // Notebook 7 in notebook view
            const notebook7SearchHandler = new Notebook7SearchHandler();
            cellExtension.setSearchHandler(notebook7SearchHandler);
          } else {
            // JupyterLab
            const labSearchHandler = new LabSearchHandler(app);
            cellExtension.setSearchHandler(labSearchHandler);
          }
        }

        // Check if URL has search parameters and activate the panel if needed
        console.log(
          `${LOG_PREFIX} Checking URL params, hasSearchParams() =`,
          hasSearchParams()
        );
        if (hasSearchParams()) {
          console.log(
            `${LOG_PREFIX} Will activate panel, platform type =`,
            platform.type
          );
          if (
            platform.type === PlatformType.JUPYTER_LAB_OR_NOTEBOOK7_NOTEBOOK
          ) {
            // JupyterLab or Notebook7 in notebook view
            setTimeout(() => {
              app.shell.activateById('nbsearch::notebooksearch');
              console.log(
                `${LOG_PREFIX} Panel activated due to URL search parameters`
              );
            }, 500);
          } else if (
            platform.type === PlatformType.JUPYTER_NOTEBOOK7_TREE &&
            treeWidget
          ) {
            // Notebook7 tree view - activate the tab in the TabPanel
            const { notebook7TreePanels } = platform;
            if (notebook7TreePanels) {
              setTimeout(() => {
                // Find the index of our widget in the tab panel
                const widgets = Array.from(notebook7TreePanels.tree.widgets);
                const index = widgets.indexOf(treeWidget);
                if (index >= 0) {
                  // Activate the tab by setting currentIndex
                  notebook7TreePanels.tree.currentIndex = index;
                  console.log(
                    `${LOG_PREFIX} Tab activated in Notebook7 tree view`
                  );
                }
              }, 500);
            }
          }
        }
      })
      .catch(reason => {
        console.error(`${LOG_PREFIX} Failed to load settings.`, reason);
      });
  }
};

export default plugin;
