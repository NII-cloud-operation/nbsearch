import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Cell, ICellModel } from '@jupyterlab/cells';

import { Box } from '@mui/material';

import { searchIcon } from './icons';
import { Search, SearchError, SearchQuery } from '../components/search';
import {
  CellSearchMode,
  Query,
  getSolrQueryFromCell
} from '../components/query/cell';
import { ResultEntity } from '../components/result/result';
import { CellSearchResponse, performSearch, SearchTarget } from './handler';
import { NotebookManager } from '../extensions/cellmanager';
import {
  CellLocationSelector,
  CellLocation
} from '../components/cell-location';
import { SolrQuery } from '../components/query/base';
import { IndexedColumnId } from '../components/result/result';
import { ResultColumn } from '../components/result/results';

type SearchWidgetProps = {
  documents: IDocumentManager;
  notebookTracker: INotebookTracker;
  notebookManager: NotebookManager;
};

export const CELL_SEARCH_WIDGET_ID = 'nbsearch::cellsearch';

const resultColumns: ResultColumn[] = [
  {
    id: IndexedColumnId.Source,
    label: 'Source',
    value: ['source__markdown', 'source__code']
  },
  {
    id: IndexedColumnId.Path,
    label: 'Path',
    value: 'notebook_filename'
  },
  {
    id: IndexedColumnId.Server,
    label: 'Server',
    value: 'notebook_server'
  },
  {
    id: IndexedColumnId.Owner,
    label: 'Owner',
    value: 'notebook_owner'
  },
  {
    id: IndexedColumnId.EstimatedModifiedTime,
    label: 'Executed/Modified',
    value: 'estimated_mtime'
  }
];

export function SearchWidget({
  documents,
  notebookTracker,
  notebookManager
}: SearchWidgetProps): JSX.Element {
  const [results, setResults] = useState<ResultEntity[]>([]);
  const [page, setPage] = useState<{
    start: number;
    limit: number;
    numFound: number;
  } | null>(null);
  const [error, setError] = useState<SearchError | undefined>(undefined);
  const [currentNotebookPanel, setCurrentNotebookPanel] =
    useState<NotebookPanel | null>(null);
  const [currentCell, setCurrentCell] = useState<Cell<ICellModel> | null>(null);
  const isNotebookOpened = useMemo(() => {
    return (
      currentNotebookPanel !== null &&
      currentNotebookPanel.title.label.trim().length > 0
    );
  }, [currentNotebookPanel]);
  const [currentCellLocation, setCurrentCellLocation] = useState<CellLocation>(
    CellLocation.CURRENT
  );
  const candidateOverlay = useMemo(() => {
    if (currentNotebookPanel === null || currentCell === null) {
      return null;
    }
    return (
      notebookManager.findCell(
        currentNotebookPanel.content.id,
        currentCell.model.id
      ) || null
    );
  }, [currentNotebookPanel, currentCell, notebookManager]);
  const queryFactory = useCallback(
    (onChange: (query: SolrQuery) => void) => {
      if (!currentCell) {
        return null;
      }
      return (
        <Query
          targetCell={currentCell}
          location={currentCellLocation}
          onChange={onChange}
        ></Query>
      );
    },
    [currentCell, currentCellLocation]
  );
  const searched = useCallback(
    (query: SearchQuery) => {
      performSearch<CellSearchResponse>(SearchTarget.Cell, query)
        .then(results => {
          setError(undefined);
          setResults(results.cells);
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
      if (candidateOverlay === null) {
        console.warn('No candidate overlay', result);
        return;
      }
      candidateOverlay.setResult(currentCellLocation, result);
    },
    [documents, candidateOverlay, currentCellLocation]
  );
  useEffect(() => {
    if (!notebookTracker) {
      return;
    }
    if (notebookTracker.currentWidget !== null) {
      setCurrentNotebookPanel(notebookTracker.currentWidget);
    }
    if (notebookTracker.activeCell !== null) {
      setCurrentCell(notebookTracker.activeCell);
    }
    notebookTracker.currentChanged.connect(source => {
      setCurrentNotebookPanel(source.currentWidget);
    });
    notebookTracker.activeCellChanged.connect((_, cell) => {
      setCurrentCell(cell);
    });
  }, [notebookTracker]);
  if (!isNotebookOpened) {
    return <Box>Open a notebook to search</Box>;
  }
  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <CellLocationSelector
        targetCell={currentCell || undefined}
        onSelected={location => setCurrentCellLocation(location)}
        defaultLocation={CellLocation.CURRENT}
      />
      <Search
        columns={resultColumns}
        onSearch={searched}
        onResultSelect={selected}
        defaultQuery={
          currentCell !== null
            ? getSolrQueryFromCell(
                currentCell,
                CellSearchMode.ByMEME,
                currentCellLocation
              )
            : { queryString: '_text_:*' }
        }
        queryFactory={queryFactory}
        start={page?.start}
        limit={page?.limit}
        numFound={page?.numFound}
        results={results}
        error={error}
      />
    </Box>
  );
}

export function buildCellWidget(
  documents: IDocumentManager,
  notebookTracker: INotebookTracker,
  notebookManager: NotebookManager
): ReactWidget {
  const widget = ReactWidget.create(
    <SearchWidget
      documents={documents}
      notebookTracker={notebookTracker}
      notebookManager={notebookManager}
    />
  );
  widget.id = CELL_SEARCH_WIDGET_ID;
  widget.title.icon = searchIcon;
  widget.title.caption = 'Search Cell';
  return widget;
}
