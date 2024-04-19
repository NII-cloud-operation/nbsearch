import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { Box } from '@mui/material';

import { searchIcon } from './icons';
import { Search, SearchError, SearchQuery } from '../components/search';
import { ResultEntity } from '../components/result/result';
import { Query } from '../components/query/notebook';
import {
  NotebookSearchResponse,
  performSearch,
  prepareNotebook,
  SearchTarget
} from './handler';
import { IndexedColumnId } from '../components/result/result';
import { ResultColumn } from '../components/result/results';

type SearchWidgetProps = {
  documents: IDocumentManager;
  notebookTracker?: INotebookTracker;
};

const resultColumns: ResultColumn[] = [
  {
    id: IndexedColumnId.Path,
    label: 'Path',
    value: 'filename'
  },
  {
    id: IndexedColumnId.Server,
    label: 'Server',
    value: 'signature_server_url'
  },
  {
    id: IndexedColumnId.Owner,
    label: 'Owner',
    value: 'owner'
  },
  {
    id: IndexedColumnId.Modified,
    label: 'Modified',
    value: 'mtime'
  },
  {
    id: IndexedColumnId.Executed,
    label: 'Executed',
    value: 'lc_cell_meme__execution_end_time'
  },
  {
    id: IndexedColumnId.OperationNote,
    label: 'Operation Note',
    value: 'source__markdown__operation_note'
  },
  {
    id: IndexedColumnId.NumberOfHeaders,
    label: '# of Headers',
    value: 'source__markdown__heading_count'
  }
];

export function SearchWidget(props: SearchWidgetProps): JSX.Element {
  const { documents, notebookTracker } = props;
  const [results, setResults] = useState<ResultEntity[]>([]);
  const [page, setPage] = useState<{
    start: number;
    limit: number;
    numFound: number;
  } | null>(null);
  const [error, setError] = useState<SearchError | undefined>(undefined);
  const [currentNotebookPanel, setCurrentNotebookPanel] =
    useState<NotebookPanel | null>(null);
  const currentNotebookName = useMemo(() => {
    if (currentNotebookPanel === null) {
      return '';
    }
    return currentNotebookPanel.title.label;
  }, [currentNotebookPanel]);
  const searched = useCallback(
    (query: SearchQuery) => {
      performSearch<NotebookSearchResponse>(SearchTarget.Notebook, query)
        .then(results => {
          setError(undefined);
          setResults(results.notebooks);
          setPage({
            start: results.start,
            limit: results.limit,
            numFound: results.numFound
          });
        })
        .catch(error => {
          setError(error);
        });
    },
    [results]
  );
  const selected = useCallback(
    (result: ResultEntity) => {
      prepareNotebook('/nbsearch-tmp', result.id)
        .then(result => {
          documents.openOrReveal(`/nbsearch-tmp/${result.filename}`);
        })
        .catch(error => {
          setError(error);
        });
    },
    [documents]
  );
  useEffect(() => {
    if (!notebookTracker) {
      return;
    }
    if (notebookTracker.currentWidget !== null) {
      setCurrentNotebookPanel(notebookTracker.currentWidget);
    }
    notebookTracker.currentChanged.connect(source => {
      setCurrentNotebookPanel(source.currentWidget);
    });
  }, [notebookTracker]);
  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      {currentNotebookName}
      <Search
        columns={resultColumns}
        onSearch={searched}
        onResultSelect={selected}
        defaultQuery={{
          queryString: '_text_:*'
        }}
        queryFactory={solrQueryChanged => (
          <Query onChange={solrQueryChanged}></Query>
        )}
        start={page?.start}
        limit={page?.limit}
        numFound={page?.numFound}
        results={results}
        error={error}
      />
    </Box>
  );
}

export function buildTreeWidget(
  documents: IDocumentManager,
  withLabel: boolean
): ReactWidget {
  const widget = ReactWidget.create(<SearchWidget documents={documents} />);
  widget.id = 'nbsearch::notebooksearch';
  widget.title.icon = searchIcon;
  widget.title.caption = 'Search Notebook';
  if (withLabel) {
    widget.title.label = 'Search Notebook';
  }
  return widget;
}
