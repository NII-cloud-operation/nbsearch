import React, { useCallback, useState } from 'react';
import { stringify } from 'yaml';
import { ReactWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

import { Box, ThemeProvider } from '@mui/material';

import { theme } from '../themes/search';
import { Search, SearchError, SearchQuery } from '../components/search';
import { Query } from '../components/query/notebook';
import { CompositeQuery, Composition } from '../components/query/fields';
import { ResultEntity } from '../components/result/result';
import {
  NotebookSearchResponse,
  performSearch,
  prepareNotebook,
  SearchTarget
} from './handler';
import { NotebookManager } from '../extensions/cellmanager';
import { SolrQuery } from '../components/query/base';
import { IndexedColumnId } from '../components/result/result';
import { ResultColumn } from '../components/result/results';
import { requestAPI } from '../handler';
import { nbsearchIcon } from './icons';
import {
  showSectionSelectionDialog,
  NotebookSection
} from '../components/dialog/section-selection';

type KeywordWithComposition = {
  composition: Composition;
  keyword: Keyword;
};

type KeywordWithSections = {
  query: KeywordWithComposition;
  sections: string[];
};

/**
 * Get the output element from a CodeCell
 */
function getOutputElementFromCodeCell(codeCell: CodeCell): HTMLElement {
  if (!codeCell || !codeCell.node) {
    throw new Error('Invalid CodeCell provided');
  }

  // Find the output area within the cell
  const outputArea = codeCell.node.querySelector('.jp-OutputArea-output');
  if (outputArea) {
    return outputArea as HTMLElement;
  }

  // If no existing output, create one
  const outputAreaContainer = codeCell.node.querySelector('.jp-OutputArea');
  if (outputAreaContainer) {
    const outputElement = document.createElement('div');
    outputElement.className = 'jp-OutputArea-output jp-RenderedWidget';
    outputElement.setAttribute(
      'data-mime-type',
      'application/vnd.jupyter.widget-view+json'
    );
    outputAreaContainer.appendChild(outputElement);
    return outputElement;
  }
  throw new Error('No output area found in the provided CodeCell');
}

type Keyword = {
  [key: string]: string;
};

function getSolrQueryFromKeyword(keyword: KeywordWithComposition): string {
  return Object.entries(keyword.keyword)
    .map(([key, value]) => `${key}:${value}`)
    .join(keyword.composition === Composition.And ? ' AND ' : ' OR ');
}

function getCompositeQueryFromKeyword(
  keyword: KeywordWithComposition
): CompositeQuery {
  const fields = Object.entries(keyword.keyword).map(([key, value]) => ({
    target: key as IndexedColumnId,
    query: value
  }));

  return {
    composition: keyword.composition,
    fields:
      fields.length > 0
        ? fields
        : [
            {
              target: IndexedColumnId.FullText,
              query: '*'
            }
          ]
  };
}

function getKeywordFromCompositeQuery(
  compositeQuery: CompositeQuery
): KeywordWithComposition {
  const keyword: Keyword = {};
  for (const field of compositeQuery.fields) {
    keyword[field.target] = field.query;
  }
  return {
    composition: compositeQuery.composition,
    keyword: keyword
  };
}

function extractHeaderFromMarkdownCell(cell: any): string | null {
  if (cell.cell_type !== 'markdown' || !cell.source) {
    return null;
  }

  // Convert source to array of lines
  const sourceLines = Array.isArray(cell.source)
    ? cell.source
    : cell.source.split('\n');

  // Look for the first line that starts with # (ignoring empty lines)
  for (const line of sourceLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('#')) {
      return trimmedLine;
    }
    // If we encounter a non-empty line that's not a header, stop looking
    if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
      break;
    }
  }

  return null;
}

function parseNotebookSections(cells: any[]): NotebookSection[] {
  const sections: NotebookSection[] = [];
  let currentSectionStart = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const headerText = extractHeaderFromMarkdownCell(cell);

    // Check if this is a markdown cell with a header
    if (headerText) {
      // If we have a previous section, add it
      if (i > currentSectionStart) {
        const prevHeaderCell = cells[currentSectionStart];
        const prevTitle =
          extractHeaderFromMarkdownCell(prevHeaderCell) ||
          `Section ${sections.length + 1}`;

        sections.push({
          title: prevTitle,
          startIndex: currentSectionStart,
          endIndex: i - 1,
          cells: cells.slice(currentSectionStart, i)
        });
      }

      currentSectionStart = i;
    }
  }

  // Add the last section
  if (currentSectionStart < cells.length) {
    const lastHeaderCell = cells[currentSectionStart];
    const lastTitle =
      extractHeaderFromMarkdownCell(lastHeaderCell) ||
      `Section ${sections.length + 1}`;

    sections.push({
      title: lastTitle,
      startIndex: currentSectionStart,
      endIndex: cells.length - 1,
      cells: cells.slice(currentSectionStart)
    });
  }

  return sections;
}

type MagicSearchWidgetProps = {
  currentCell: CodeCell;
  documents: IDocumentManager;
  notebookTracker: INotebookTracker;
  notebookManager: NotebookManager;
  keyword?: KeywordWithComposition;
  lastSelectedSections?: string[];
  onClosed?: (
    inserted: boolean,
    latestCompositeQuery?: CompositeQuery,
    selectedSectionTitles?: string[]
  ) => void;
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

const searchFields: IndexedColumnId[] = resultColumns
  .map(r => r.id)
  .concat([
    IndexedColumnId.Cells,
    IndexedColumnId.Outputs,
    IndexedColumnId.CellMemes
  ]);

export function MagicSearchWidget({
  currentCell,
  documents,
  notebookTracker,
  notebookManager,
  keyword,
  lastSelectedSections,
  onClosed
}: MagicSearchWidgetProps): JSX.Element | null {
  const [results, setResults] = useState<ResultEntity[]>([]);
  const [page, setPage] = useState<{
    start: number;
    limit: number;
    numFound: number;
  } | null>(null);
  const [error, setError] = useState<SearchError | undefined>(undefined);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [latestCompositeQuery, setLatestCompositeQuery] = useState<
    CompositeQuery | undefined
  >(keyword ? getCompositeQueryFromKeyword(keyword) : undefined);

  const searchHandler = useCallback(
    (query: SearchQuery, finished: () => void) => {
      performSearch<NotebookSearchResponse>(SearchTarget.Notebook, query)
        .then(results => {
          setError(undefined);
          setResults(results.notebooks);
          setPage({
            start: results.start,
            limit: results.limit,
            numFound: results.numFound
          });
          finished();
        })
        .catch(error => {
          setError(error);
          finished();
        });
    },
    []
  );

  const added = useCallback(
    async (result: ResultEntity) => {
      console.log('Selected result:', result);

      // Call DataHandler with notebook_id
      if (!result.id) {
        console.warn('No notebook_id found in result');
        return;
      }
      try {
        const notebookData = await requestAPI<any>(`v1/data/${result.id}`);
        console.log('DataHandler response:', notebookData);

        // Get the current notebook and find the current cell's index
        const currentNotebook = notebookTracker.currentWidget?.model;
        if (!currentNotebook || !notebookData.notebook?.cells) {
          console.warn('No current notebook or cells data');
          return;
        }

        // Parse notebook into sections
        const sections = parseNotebookSections(notebookData.notebook.cells);

        // Show section selection dialog
        const selectedSections = await showSectionSelectionDialog(
          sections,
          lastSelectedSections
        );

        if (!selectedSections || selectedSections.length === 0) {
          console.log(
            'Cell insertion cancelled by user or no sections selected'
          );
          return;
        }

        // Find the index of the current cell
        const currentCellIndex = [...currentNotebook.cells].findIndex(
          cell => cell.id === currentCell.model.id
        );

        if (currentCellIndex === -1) {
          console.warn('Current cell not found in notebook');
          return;
        }

        // selectedSections is already validated above

        // Insert cells from selected sections after the current cell
        let insertIndex = currentCellIndex + 1;
        let totalInsertedCells = 0;

        for (const section of selectedSections) {
          for (const cellData of section.cells) {
            const newCell = {
              cell_type: cellData.cell_type,
              source: cellData.source,
              metadata: cellData.metadata || {},
              trusted: true
            };
            currentNotebook.sharedModel.insertCell(insertIndex, newCell);
            insertIndex++;
            totalInsertedCells++;
          }
        }

        console.log(
          `Inserted ${totalInsertedCells} cells from ${selectedSections.length} sections after current cell`,
          'Latest composite query:',
          latestCompositeQuery
        );

        // Close the search display
        setIsClosed(true);
        if (onClosed) {
          const selectedSectionTitles = selectedSections.map(
            section => section.title
          );
          onClosed(true, latestCompositeQuery, selectedSectionTitles);
        }
      } catch (error) {
        console.error('Error calling DataHandler:', error);
      }
    },
    [notebookTracker, currentCell, latestCompositeQuery, onClosed, documents]
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

  if (isClosed) {
    return null;
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        className="nbsearch-magic-root"
        sx={{ border: '2px solid #1976d2', borderRadius: 2, p: 2, m: 1 }}
      >
        <Box sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2', fontSize: 18 }}>
          <span
            dangerouslySetInnerHTML={{ __html: nbsearchIcon }}
            style={{ marginRight: '8px', display: 'inline-block' }}
          />
          NBSearch
        </Box>
        <Search
          columns={resultColumns}
          onSearch={searchHandler}
          onResultSelect={selected}
          showAddButton={true}
          onResultAdd={added}
          autoSearch={true}
          defaultQuery={
            keyword
              ? { queryString: getSolrQueryFromKeyword(keyword) }
              : { queryString: '_text_:*' }
          }
          queryFactory={(solrQueryChanged, onSearch) => (
            <Query
              fields={searchFields}
              onChange={(query: SolrQuery, compositeQuery?: CompositeQuery) => {
                // Update latest composite query if available
                if (compositeQuery) {
                  setLatestCompositeQuery(compositeQuery);
                }
                solrQueryChanged({
                  get: () => query
                });
              }}
              onSearch={onSearch}
              initialFieldsValue={
                keyword ? getCompositeQueryFromKeyword(keyword) : undefined
              }
            ></Query>
          )}
          queryContext={{}}
          start={page?.start}
          limit={page?.limit}
          numFound={page?.numFound}
          results={results}
          error={error}
          onClosed={
            onClosed
              ? () => onClosed(false, latestCompositeQuery, [])
              : undefined
          }
        />
      </Box>
    </ThemeProvider>
  );
}

export function createMagicSearchWidget(
  documents: IDocumentManager,
  notebookTracker: INotebookTracker,
  notebookManager: NotebookManager,
  keywordWithSections: Keyword | KeywordWithSections,
  codeCell: CodeCell
): void {
  // Get output element from the CodeCell
  const outputElement = getOutputElementFromCodeCell(codeCell);
  let outputWrapper: HTMLElement | null = null;
  const keyword: KeywordWithComposition = (
    keywordWithSections.query as KeywordWithComposition
  )?.composition
    ? (keywordWithSections.query as KeywordWithComposition)
    : {
        composition: Composition.And,
        keyword: keywordWithSections as Keyword
      };
  const lastSelectedSections: string[] = (
    keywordWithSections.query as KeywordWithComposition
  )?.composition
    ? (keywordWithSections as KeywordWithSections).sections
    : [];

  // Create a custom ReactWidget class for output area mounting (multi-outputs pattern)
  class MagicSearchOutputWidget extends ReactWidget {
    constructor() {
      super();
      this.addClass('nbsearch-magic-output-widget');
      this.addClass('jp-RenderedWidget');
    }

    render(): JSX.Element {
      return (
        <MagicSearchWidget
          currentCell={codeCell}
          documents={documents}
          notebookTracker={notebookTracker}
          notebookManager={notebookManager}
          keyword={keyword}
          lastSelectedSections={lastSelectedSections}
          onClosed={(
            inserted: boolean,
            latestCompositeQuery?: CompositeQuery,
            selectedSectionTitles?: string[]
          ) => {
            // Use the latest composite query if available, otherwise fall back to original keyword
            const keywordToUse = latestCompositeQuery
              ? getKeywordFromCompositeQuery(latestCompositeQuery)
              : keyword || {};

            // Convert keyword to YAML and set as cell source
            let yamlLines: string[] = ['%%nbsearch'];
            const yamlData: KeywordWithSections = {
              query: keywordToUse,
              sections: selectedSectionTitles || []
            };
            yamlLines = yamlLines.concat(
              stringify(yamlData).trim().split('\n')
            );
            if (inserted) {
              yamlLines = yamlLines.map(line => `# ${line}`);
            }
            const yamlString = yamlLines.join('\n');
            codeCell.model.sharedModel.setSource(yamlString);

            if (outputWrapper) {
              outputWrapper.style.display = 'none';
            }
          }}
        />
      );
    }

    // Public method to trigger attach lifecycle
    public triggerAttach(): void {
      try {
        this.onAfterAttach(null);
        console.log('MagicSearchOutputWidget attached successfully');
      } catch (error) {
        console.warn('Error triggering attach:', error);
      }
    }

    // Public method to trigger detach lifecycle
    public triggerDetach(): void {
      try {
        this.onBeforeDetach(null);
        console.log('MagicSearchOutputWidget detaching');
      } catch (error) {
        console.warn('Error triggering detach:', error);
      }
    }

    protected onAfterAttach(msg: any): void {
      super.onAfterAttach(msg);
    }

    protected onBeforeDetach(msg: any): void {
      super.onBeforeDetach(msg);
    }
  }

  const widget = new MagicSearchOutputWidget();
  console.log('Custom ReactWidget created:', widget);

  mountToOutputArea(widget, outputElement);

  // Mount widget to output area using multi-outputs pattern
  function mountToOutputArea(widget: any, element: HTMLElement) {
    element.innerHTML = '';

    outputWrapper = document.createElement('div');
    outputWrapper.className = 'jp-OutputArea-output jp-RenderedWidget';
    outputWrapper.setAttribute(
      'data-mime-type',
      'application/vnd.jupyter.widget-view+json'
    );
    outputWrapper.style.cssText = `
        width: 100%;
        overflow: visible;
        display: block;
        position: relative;
      `;

    // Add the wrapper to the output element first
    element.appendChild(outputWrapper);

    // Now attach the widget to the wrapper
    if (!widget.node) {
      console.error('Widget node is not available, ignoring mount');
      return;
    }

    // Set widget node styles for proper output area display
    widget.node.style.cssText = `
          width: 100%;
          display: block;
          overflow: visible;
          min-height: 200px;
        `;

    outputWrapper.appendChild(widget.node);

    // Trigger widget lifecycle - this is crucial for multi-outputs
    setTimeout(() => {
      try {
        // Call onAfterAttach to properly initialize the widget
        widget.triggerAttach();
        console.log('Widget lifecycle events triggered successfully');
      } catch (lifecycleError) {
        console.warn('Widget lifecycle error (non-critical):', lifecycleError);
      }
    }, 100);
  }
}
