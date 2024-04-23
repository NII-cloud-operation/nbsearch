import { JupyterFrontEnd } from '@jupyterlab/application';
import { Widget, TabPanel } from '@lumino/widgets';

type WidgetFactory = (withLabel: boolean) => Widget;

export class FilesInitializer {
  widgetFactory: WidgetFactory;

  constructor(widgetFactory: WidgetFactory) {
    this.widgetFactory = widgetFactory;
  }

  start(app: JupyterFrontEnd) {
    app.shell.add(this.widgetFactory(false), 'left', { rank: 2000 });
    this.addToMain(app);
  }

  addToMain(app: JupyterFrontEnd) {
    const widgets = Array.from(app.shell.widgets('main'));
    if (widgets.length === 0) {
      setTimeout(() => {
        this.addToMain(app);
      }, 10);
      return;
    }
    const tab = widgets[0] as TabPanel;
    if (!tab.addWidget) {
      console.log('nbsearch: running on JupyterLab');
      return;
    }
    tab.addWidget(this.widgetFactory(true));
  }
}
