import { SearchQuery } from '../components/search';
import { ResultEntity } from '../components/result/result';
import { requestAPI } from '../handler';
import { SortOrder } from '../components/result/results';

export type ResponseBase = {
  limit: number;
  start: number;
  numFound: number;
};

export type NotebookSearchResponse = ResponseBase & {
  notebooks: ResultEntity[];
};

export type CellSearchResponse = ResponseBase & {
  cells: ResultEntity[];
};

export type NotebookResponse = {
  filename: string;
};

export enum SearchTarget {
  Notebook = 'notebook',
  Cell = 'cell'
}

export async function performSearch<T extends ResponseBase>(
  target: SearchTarget,
  query: SearchQuery
): Promise<T> {
  const params: {
    query: string;
    sort?: string;
    limit?: string;
    start?: string;
    q_op?: string;
  } = {
    query: query.queryString,
    q_op: query.q_op
  };
  const { sortQuery, pageQuery } = query;
  if (sortQuery) {
    params.sort = `${sortQuery.column} ${
      sortQuery.order === SortOrder.Ascending ? 'asc' : 'desc'
    }`;
  }
  if (pageQuery) {
    params.limit = pageQuery.limit.toString();
    params.start = pageQuery.start.toString();
  }
  const resp = await requestAPI<T>(
    `v1/${target}/search?${new URLSearchParams(params)}`
  );
  return resp;
}

export async function prepareNotebook(
  path: string,
  id: string
): Promise<NotebookResponse> {
  const resp = await requestAPI<NotebookResponse>(`v1/import${path}/${id}`);
  return resp;
}
