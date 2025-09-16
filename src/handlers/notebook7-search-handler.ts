import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { ISearchHandler } from '../extensions/markdown-intervention';
import {
  searchQueryToURLParams,
  applyIURLSearchParamsToURLSearchParams
} from '../utils/url-params';
import { SearchQuery } from '../components/search';

export class Notebook7SearchHandler implements ISearchHandler {
  performSearch(query: string): void {
    // Open search in new tab with /tree endpoint
    const settings = ServerConnection.makeSettings();
    const treeUrl = URLExt.join(settings.baseUrl, 'tree');
    const url = new URL(treeUrl, window.location.origin);

    const searchQuery: SearchQuery = {
      queryString: query
    };
    const urlParams = searchQueryToURLParams(searchQuery);

    applyIURLSearchParamsToURLSearchParams(urlParams, url.searchParams);

    window.open(url.toString(), '_blank');
  }
}
