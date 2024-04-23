import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';

import { buildTreeWidget } from './widgets/tree-search';
import { buildCellWidget } from './widgets/cell-search';
import { Platform, PlatformType, getPlatform } from './widgets/platform';
import { ToolbarExtension } from './extensions/toolbar';
import { CellExtension } from './extensions/cell';
import { NotebookManager } from './extensions/cellmanager';

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
