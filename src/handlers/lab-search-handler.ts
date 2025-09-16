import { JupyterFrontEnd } from '@jupyterlab/application';
import { ISearchHandler } from '../extensions/markdown-intervention';
import { getSearchWidgetInstance } from '../widgets/tree-search';

export class LabSearchHandler implements ISearchHandler {
  private app: JupyterFrontEnd;

  constructor(app: JupyterFrontEnd) {
    this.app = app;
  }

  performSearch(query: string, timestamp: number): void {
    // Activate the notebook search panel
    this.app.shell.activateById('nbsearch::notebooksearch');

    // Get the search widget instance and set the query
    const searchWidget = getSearchWidgetInstance();
    if (searchWidget) {
      searchWidget.setSearchQuery(query, timestamp);
    } else {
      console.warn('[nbsearch] Search widget not available');
    }
  }
}