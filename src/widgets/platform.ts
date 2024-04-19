import { JupyterFrontEnd } from '@jupyterlab/application';
import { TabPanel } from '@lumino/widgets';

export enum PlatformType {
  JUPYTER_LAB_OR_NOTEBOOK7_NOTEBOOK,
  JUPYTER_NOTEBOOK7_TREE
}

export type Notebook7TreePanels = {
  tree: TabPanel;
};

export type Platform = {
  type: PlatformType;
  notebook7TreePanels?: Notebook7TreePanels;
};

function getTreeTab(widget: any): TabPanel | null {
  const tab = widget as TabPanel;
  return !tab.addWidget ? null : tab;
}

function checkPlatform(
  app: JupyterFrontEnd,
  callback: (platform: Platform) => void
) {
  const widgets = Array.from(app.shell.widgets('main'));
  if (widgets.length === 0) {
    setTimeout(() => {
      checkPlatform(app, callback);
    }, 10);
    return;
  }
  const tab = getTreeTab(widgets[0]);
  if (tab !== null) {
    callback({
      type: PlatformType.JUPYTER_NOTEBOOK7_TREE,
      notebook7TreePanels: { tree: tab }
    });
    return;
  }
  callback({
    type: PlatformType.JUPYTER_LAB_OR_NOTEBOOK7_NOTEBOOK
  });
}

export function getPlatform(app: JupyterFrontEnd): Promise<Platform> {
  return new Promise<Platform>((resolve, reject) => {
    checkPlatform(app, platform => {
      resolve(platform);
    });
  });
}
