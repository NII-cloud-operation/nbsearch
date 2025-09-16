import { SearchQuery } from '../components/search';
import { SortOrder } from '../components/result/results';
import { IndexedColumnId } from '../components/result/result';

export interface IURLSearchParams {
  solrquery?: string;
  sort?: string;
  start?: number;
  limit?: number;
  size?: number;
  numFound?: number;
  error?: string;
  nbsearch?: string;
}

export function getSearchParamsFromURL(): IURLSearchParams {
  const params = new URLSearchParams(window.location.search);
  const result: IURLSearchParams = {};

  const solrquery = params.get('solrquery');
  if (solrquery) {
    result.solrquery = solrquery;
  }

  const sort = params.get('sort');
  if (sort) {
    result.sort = sort;
  }

  const start = params.get('start');
  if (start) {
    const startNum = parseInt(start, 10);
    if (!isNaN(startNum) && startNum >= 0) {
      result.start = startNum;
    }
  }

  const limit = params.get('limit');
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      result.limit = limitNum;
    }
  }

  const size = params.get('size');
  if (size) {
    const sizeNum = parseInt(size, 10);
    if (!isNaN(sizeNum) && sizeNum >= 0) {
      result.size = sizeNum;
    }
  }

  const numFound = params.get('numFound');
  if (numFound) {
    const numFoundNum = parseInt(numFound, 10);
    if (!isNaN(numFoundNum) && numFoundNum >= 0) {
      result.numFound = numFoundNum;
    }
  }

  const error = params.get('error');
  if (error) {
    result.error = error;
  }

  const nbsearch = params.get('nbsearch');
  if (nbsearch) {
    result.nbsearch = nbsearch;
  }

  return result;
}

export function applyIURLSearchParamsToURLSearchParams(
  params: IURLSearchParams,
  searchParams: URLSearchParams
): URLSearchParams {
  // Update or remove each parameter
  if (params.solrquery !== undefined) {
    if (params.solrquery && params.solrquery !== '_text_:*') {
      searchParams.set('solrquery', params.solrquery);
    } else {
      searchParams.delete('solrquery');
    }
  }

  if (params.sort !== undefined) {
    if (params.sort) {
      searchParams.set('sort', params.sort);
    } else {
      searchParams.delete('sort');
    }
  }

  if (params.start !== undefined) {
    if (params.start > 0) {
      searchParams.set('start', params.start.toString());
    } else {
      searchParams.delete('start');
    }
  }

  if (params.limit !== undefined) {
    if (params.limit > 0) {
      searchParams.set('limit', params.limit.toString());
    } else {
      searchParams.delete('limit');
    }
  }

  if (params.nbsearch !== undefined) {
    searchParams.set('nbsearch', params.nbsearch);
  }
  return searchParams;
}

export function updateURLSearchParams(params: IURLSearchParams): void {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  applyIURLSearchParamsToURLSearchParams(params, searchParams);

  url.search = searchParams.toString();
  window.history.replaceState({}, '', url.toString());
}

export function searchQueryToURLParams(query: SearchQuery): IURLSearchParams {
  const params: IURLSearchParams = {
    solrquery: query.queryString,
    nbsearch: 'yes'
  };

  if (query.sortQuery) {
    // Convert sort format: "column order" (e.g., "mtime desc")
    const order =
      query.sortQuery.order === SortOrder.Ascending ? 'asc' : 'desc';
    params.sort = `${query.sortQuery.column} ${order}`;
  }

  if (query.pageQuery) {
    params.start = query.pageQuery.start;
    params.limit = query.pageQuery.limit;
  }

  return params;
}

export function urlParamsToSearchQuery(
  params: IURLSearchParams
): Partial<SearchQuery> {
  const query: Partial<SearchQuery> = {};

  if (params.solrquery) {
    query.queryString = params.solrquery;
  }

  if (params.sort) {
    // Parse sort format: "column order" (e.g., "mtime desc")
    const sortParts = params.sort.split(' ');
    if (sortParts.length >= 2) {
      const column = sortParts.slice(0, -1).join(' '); // Handle column names with spaces
      const order = sortParts[sortParts.length - 1];
      query.sortQuery = {
        column: column as IndexedColumnId,
        order: order === 'asc' ? SortOrder.Ascending : SortOrder.Descending
      };
    }
  }

  if (params.start !== undefined || params.limit !== undefined) {
    query.pageQuery = {
      start: params.start ?? 0,
      limit: params.limit ?? 50
    };
  }

  return query;
}

export function hasSearchParams(): boolean {
  const params = getSearchParamsFromURL();
  return params.nbsearch === 'yes';
}

export function clearURLSearchParams(): void {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);

  // Remove only search-related parameters
  searchParams.delete('solrquery');
  searchParams.delete('sort');
  searchParams.delete('start');
  searchParams.delete('limit');
  searchParams.delete('size');
  searchParams.delete('numFound');
  searchParams.delete('error');
  searchParams.delete('nbsearch');

  url.search = searchParams.toString();
  window.history.replaceState({}, '', url.toString());
}
