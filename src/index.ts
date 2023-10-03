import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { FilesInitializer } from './widgets/files-initializer';
import { buildWidget } from './widgets/search-widget';


function initWidgets(
  app: JupyterFrontEnd,
  documents: IDocumentManager,
  settings: ISettingRegistry.ISettings,
) {
  const initializer = new FilesInitializer(
    (withLabel: boolean) => buildWidget(documents, withLabel),
  );
  initializer.start(app);
}

/**
 * Initialization data for the nbsearch extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nbsearch:plugin',
  description: 'NBSearch Jupyter Extension',
  autoStart: true,
  optional: [ISettingRegistry, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null,
    documents: IDocumentManager | null,
  ) => {
    console.log('JupyterLab extension nbsearch is activated!');
    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          if (!documents) {
            console.error('Failed to load document manager');
            return;
          }
          console.log('nbsearch settings loaded:', settings.composite);
          initWidgets(app, documents, settings);
        })
        .catch(reason => {
          console.error('Failed to load settings for nbsearch.', reason);
        });
    }
  }
};

export default plugin;
