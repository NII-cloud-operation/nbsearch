import { Cell } from '@jupyterlab/cells';

export type SolrQuery = {
  queryString: string;
  q_op?: string;
};

export type SolrQueryContext = {
  cell?: Cell;
};

export type LazySolrQuery = {
  get: (context: SolrQueryContext) => SolrQuery;
};
