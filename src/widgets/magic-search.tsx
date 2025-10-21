import React, { useCallback, useState } from 'react';
import { stringify } from 'yaml';
import { ReactWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';
import { ISharedMarkdownCell, ISharedRawCell } from '@jupyter/ydoc';

import {
  Box,
  ThemeProvider,
  Checkbox,
  FormControlLabel,
  Typography,
  Collapse,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { theme } from '../themes/search';
import { Search, SearchError, SearchQuery } from '../components/search';
import { Query } from '../components/query/notebook';
import { CompositeQuery, Composition } from '../components/query/fields';
import { ResultEntity } from '../components/result/result';
import {
  CellSearchResponse,
  performSearch,
  prepareNotebook,
  SearchTarget
} from './handler';
import { SolrQuery } from '../components/query/base';
import { IndexedColumnId } from '../components/result/result';
import { ResultColumn } from '../components/result/results';
import { requestAPI } from '../handler';
import { nbsearchIcon } from './icons';
import {
  showSectionSelectionDialog,
  NotebookSection,
  SectionSelectionResult,
  Scope,
  Range
} from '../components/dialog/section-selection';

type KeywordWithComposition = {
  composition: Composition;
  keyword: Keyword;
};

type MemeFilter = {
  previous: boolean;
  next: boolean;
  exactMatch: boolean;
};

type KeywordWithSections = {
  query: KeywordWithComposition;
  scope?: Scope;
  range?: Range;
  sections?: string[];
  memeFilter?: MemeFilter;
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

/**
 * Arrange metadata for a notebook cell.
 */
function arrangeMetadata(metadata: any): any {
  const newMetadata = { ...metadata };
  newMetadata.deletable = true;
  newMetadata.editable = true;
  newMetadata.trusted = true;
  return newMetadata;
}

/**
 * Get cells to insert based on selection result
 */
function getCellsFromSelectionResult(
  selectionResult: SectionSelectionResult,
  allCells: any[],
  searchResultCellMeme: string | undefined,
  sections: NotebookSection[]
): any[] {
  // Find the search result cell index
  const searchResultCellIndex = allCells.findIndex(
    cell => cell.metadata?.lc_cell_meme?.current === searchResultCellMeme
  );

  if (searchResultCellIndex === -1) {
    return [];
  }

  switch (selectionResult.scope) {
    case 'cell':
      return [allCells[searchResultCellIndex]];

    case 'section': {
      // Find the section containing the search result cell
      const section = sections.find(
        s =>
          searchResultCellIndex >= s.startIndex &&
          searchResultCellIndex <= s.endIndex
      );

      if (!section) {
        return [];
      }

      const cellIndexInSection = searchResultCellIndex - section.startIndex;

      if (selectionResult.range === 'before') {
        return section.cells.slice(0, cellIndexInSection + 1);
      } else if (selectionResult.range === 'after') {
        return section.cells.slice(cellIndexInSection);
      } else {
        return section.cells;
      }
    }

    case 'notebook':
      if (selectionResult.range === 'before') {
        // All cells from start to search result cell (inclusive)
        return allCells.slice(0, searchResultCellIndex + 1);
      } else if (selectionResult.range === 'after') {
        // All cells from search result cell to end (inclusive)
        return allCells.slice(searchResultCellIndex);
      } else if (selectionResult.range === 'all') {
        // Use selected sections (traditional behavior)
        if (
          !selectionResult.sections ||
          selectionResult.sections.length === 0
        ) {
          return [];
        }
        const cells: any[] = [];
        for (const section of selectionResult.sections) {
          cells.push(...section.cells);
        }
        return cells;
      }
      return [];

    default:
      return [];
  }
}

type Keyword = {
  [key: string]: string;
};

function getSolrQueryFromKeyword(keyword: KeywordWithComposition): string {
  return Object.entries(keyword.keyword)
    .map(([key, value]) => `${key}:${value}`)
    .join(keyword.composition === Composition.And ? ' AND ' : ' OR ');
}

function getMemeFilterLabel(filter: MemeFilter): string {
  if (!filter.previous && !filter.next) {
    return 'None';
  }
  const parts: string[] = [];
  if (filter.previous) {
    parts.push('Previous');
  }
  if (filter.next) {
    parts.push('Next');
  }
  const location = parts.join(' + ');
  return filter.exactMatch ? `${location}, Exact` : location;
}

function extractBaseMeme(meme: string | null): string | null {
  if (!meme) {
    return null;
  }
  const parts = meme.split('-');
  if (parts.length <= 5) {
    return meme;
  }
  return parts.slice(0, 5).join('-');
}

type LCCellMeme = {
  current: string;
};

type LCCellMemeMetadata = {
  lc_cell_meme?: LCCellMeme;
};

function getCellMemes(
  currentCell: CodeCell,
  notebookTracker: INotebookTracker
): { previous: string | null; next: string | null } {
  const notebookPanel = notebookTracker.currentWidget;
  if (!notebookPanel) {
    return { previous: null, next: null };
  }

  const notebook = notebookPanel.content;
  const cells = notebook.widgets;
  const currentIndex = cells.findIndex(
    cell => cell.model.id === currentCell.model.id
  );

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  let previousMeme: string | null = null;
  if (currentIndex > 0) {
    const prevCell = cells[currentIndex - 1];
    if (prevCell) {
      const metadata = prevCell.model.metadata as LCCellMemeMetadata;
      if (metadata?.lc_cell_meme?.current) {
        previousMeme = metadata.lc_cell_meme.current;
      }
    }
  }

  let nextMeme: string | null = null;
  if (currentIndex < cells.length - 1) {
    const nextCell = cells[currentIndex + 1];
    if (nextCell) {
      const metadata = nextCell.model.metadata as LCCellMemeMetadata;
      if (metadata?.lc_cell_meme?.current) {
        nextMeme = metadata.lc_cell_meme.current;
      }
    }
  }

  return { previous: previousMeme, next: nextMeme };
}

function buildMemeQuery(
  filter: MemeFilter,
  previousMeme: string | null,
  nextMeme: string | null
): string {
  const parts: string[] = [];

  if (filter.previous && previousMeme) {
    const meme = filter.exactMatch
      ? `"${previousMeme}"`
      : `${extractBaseMeme(previousMeme)}*`;
    parts.push(`lc_cell_meme__previous:${meme}`);
  }

  if (filter.next && nextMeme) {
    const meme = filter.exactMatch
      ? `"${nextMeme}"`
      : `${extractBaseMeme(nextMeme)}*`;
    parts.push(`lc_cell_meme__next:${meme}`);
  }

  return parts.join(' AND ');
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

type InsertedContent = {
  insertedMEMEs?: string[];
  scope?: Scope;
  range?: Range;
  selectedSectionTitles?: string[];
  memeFilter?: MemeFilter;
};

type MagicSearchWidgetProps = {
  currentCell: CodeCell;
  documents: IDocumentManager;
  notebookTracker: INotebookTracker;
  keyword?: KeywordWithComposition;
  lastSelectionResult: SectionSelectionResult | null;
  memeFilter?: MemeFilter;
  onClosed?: (
    inserted: boolean,
    latestCompositeQuery?: CompositeQuery,
    insertedContent?: InsertedContent
  ) => void;
};
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

const searchFields: IndexedColumnId[] = resultColumns
  .map(r => r.id)
  .concat([
    IndexedColumnId.Stdout,
    IndexedColumnId.Stderr,
    IndexedColumnId.ResultPlain,
    IndexedColumnId.ResultHTML,
    IndexedColumnId.SourceMarkdownHeading,
    IndexedColumnId.SourceMarkdownHashtags
  ]);

export function MagicSearchWidget({
  currentCell,
  documents,
  notebookTracker,
  keyword,
  lastSelectionResult,
  memeFilter: initialMemeFilter,
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
  const [memeFilter, setMemeFilter] = useState<MemeFilter>(
    initialMemeFilter || { previous: false, next: false, exactMatch: false }
  );
  const [memeFilterExpanded, setMemeFilterExpanded] = useState(false);

  const searchHandler = useCallback(
    (query: SearchQuery, finished: () => void) => {
      const cellMemes = getCellMemes(currentCell, notebookTracker);
      const memeQuery = buildMemeQuery(
        memeFilter,
        cellMemes.previous,
        cellMemes.next
      );

      const finalQuery = memeQuery
        ? { ...query, queryString: `(${query.queryString}) AND ${memeQuery}` }
        : query;

      performSearch<CellSearchResponse>(SearchTarget.Cell, finalQuery)
        .then(results => {
          setError(undefined);
          setResults(results.cells);
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
    [memeFilter, currentCell, notebookTracker]
  );

  const added = useCallback(
    async (result: ResultEntity) => {
      console.log('Selected result:', result);

      // Call DataHandler with notebook_id
      if (!result.notebook_id) {
        console.warn('No notebook_id found in result');
        return;
      }
      const notebookData = await requestAPI<any>(
        `v1/data/${result.notebook_id}`
      );

      const currentNotebook = notebookTracker.currentWidget?.model;
      if (!currentNotebook || !notebookData.notebook?.cells) {
        console.warn('No current notebook or cells data');
        return;
      }

      const sections = parseNotebookSections(notebookData.notebook.cells);

      // Show section selection dialog
      const hasMeme = !!result.lc_cell_meme__current;
      const selectionResult = await showSectionSelectionDialog(
        sections,
        hasMeme,
        lastSelectionResult
      );

      if (!selectionResult) {
        console.log('Cell insertion cancelled by user');
        return;
      }

      // Get cells to insert based on selection
      const cellsToInsert = getCellsFromSelectionResult(
        selectionResult,
        notebookData.notebook.cells,
        result.lc_cell_meme__current,
        sections
      );

      if (cellsToInsert.length === 0) {
        console.warn('No cells to insert');
        return;
      }

      const currentCellIndex = [...currentNotebook.cells].findIndex(
        cell => cell.id === currentCell.model.id
      );

      if (currentCellIndex === -1) {
        console.warn('Current cell not found in notebook');
        return;
      }

      // Get MEME sequence from cells to insert
      const selectedMEMEs: string[] = [];
      for (const cellData of cellsToInsert) {
        if (cellData.metadata?.lc_cell_meme?.current) {
          selectedMEMEs.push(cellData.metadata.lc_cell_meme.current);
        }
      }

      // Get MEME sequence from current notebook starting after currentCell
      const existingMEMEs: string[] = [];
      for (
        let i = currentCellIndex + 1;
        i < currentNotebook.cells.length;
        i++
      ) {
        const cell = currentNotebook.cells.get(i);
        const meme = (cell.metadata?.lc_cell_meme as any)?.current;
        if (meme && typeof meme === 'string') {
          existingMEMEs.push(meme);
        }
      }

      // Check if MEME sequences match
      const sequencesMatch =
        selectedMEMEs.length === existingMEMEs.length &&
        selectedMEMEs.every((meme, index) => meme === existingMEMEs[index]);

      let insertIndex = currentCellIndex + 1;
      let totalInsertedCells = 0;
      let totalUpdatedCells = 0;
      const insertedMEMEs: string[] = [];

      if (sequencesMatch) {
        // Update existing cells instead of inserting new ones
        let cellIndex = currentCellIndex + 1;
        for (const cellData of cellsToInsert) {
          if (cellIndex < currentNotebook.cells.length) {
            const existingCell = currentNotebook.cells.get(cellIndex);
            // Update cell content and metadata
            const sourceContent = Array.isArray(cellData.source)
              ? cellData.source.join('\n')
              : cellData.source;
            existingCell.sharedModel.setSource(sourceContent);
            existingCell.sharedModel.setMetadata(
              arrangeMetadata(cellData.metadata || {})
            );
            if (cellData.attachments) {
              // Only markdown and raw cells support attachments
              if (
                cellData.cell_type === 'markdown' ||
                cellData.cell_type === 'raw'
              ) {
                (
                  existingCell.sharedModel as
                    | ISharedMarkdownCell
                    | ISharedRawCell
                ).setAttachments(cellData.attachments);
              }
            }
            totalUpdatedCells++;
            cellIndex++;

            if (cellData.metadata?.lc_cell_meme?.current) {
              insertedMEMEs.push(cellData.metadata.lc_cell_meme.current);
            }
          }
        }
      } else {
        // Insert new cells as before
        for (const cellData of cellsToInsert) {
          const newCell: any = {
            cell_type: cellData.cell_type,
            source: cellData.source,
            metadata: arrangeMetadata(cellData.metadata || {}),
            trusted: true
          };
          if (
            cellData.attachments &&
            (cellData.cell_type === 'markdown' || cellData.cell_type === 'raw')
          ) {
            newCell.attachments = cellData.attachments;
          }
          currentNotebook.sharedModel.insertCell(insertIndex, newCell);
          insertIndex++;
          totalInsertedCells++;
          if (cellData.metadata?.lc_cell_meme?.current) {
            insertedMEMEs.push(cellData.metadata.lc_cell_meme.current);
          }
        }
      }

      if (sequencesMatch) {
        console.log(
          `Updated ${totalUpdatedCells} existing cells`,
          'Latest composite query:',
          latestCompositeQuery
        );
      } else {
        console.log(
          `Inserted ${totalInsertedCells} cells after current cell`,
          'Latest composite query:',
          latestCompositeQuery
        );
      }

      // Close the search display
      setIsClosed(true);
      if (onClosed) {
        onClosed(true, latestCompositeQuery, {
          insertedMEMEs,
          scope: selectionResult.scope,
          range: selectionResult.range,
          selectedSectionTitles: selectionResult.sections?.map(
            section => section.title
          ),
          memeFilter
        });
      }
    },
    [
      notebookTracker,
      currentCell,
      latestCompositeQuery,
      onClosed,
      documents,
      memeFilter
    ]
  );
  const selected = useCallback(
    (result: ResultEntity) => {
      if (!result.notebook_id) {
        console.warn('No notebook_id found in result');
        return;
      }
      prepareNotebook('/nbsearch-tmp', result.notebook_id)
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
          additionalFilters={
            <Box sx={{ m: '1em' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => setMemeFilterExpanded(!memeFilterExpanded)}
              >
                <IconButton size="small">
                  <ExpandMoreIcon
                    sx={{
                      transform: memeFilterExpanded
                        ? 'rotate(0deg)'
                        : 'rotate(-90deg)',
                      transition: 'transform 0.2s'
                    }}
                  />
                </IconButton>
                <Typography>
                  MEME Filter ({getMemeFilterLabel(memeFilter)})
                </Typography>
              </Box>
              <Collapse in={memeFilterExpanded}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    pl: 5
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={memeFilter.previous}
                        onChange={e =>
                          setMemeFilter(prev => ({
                            ...prev,
                            previous: e.target.checked
                          }))
                        }
                      />
                    }
                    label="Previous Cell MEME"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={memeFilter.next}
                        onChange={e =>
                          setMemeFilter(prev => ({
                            ...prev,
                            next: e.target.checked
                          }))
                        }
                      />
                    }
                    label="Next Cell MEME"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={memeFilter.exactMatch}
                        onChange={e =>
                          setMemeFilter(prev => ({
                            ...prev,
                            exactMatch: e.target.checked
                          }))
                        }
                        disabled={!memeFilter.previous && !memeFilter.next}
                      />
                    }
                    label="Match branch numbers exactly"
                  />
                </Box>
              </Collapse>
            </Box>
          }
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
              initialQuery={
                keyword
                  ? { queryString: getSolrQueryFromKeyword(keyword) }
                  : { queryString: '_text_:*' }
              }
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
              ? () =>
                  onClosed(false, latestCompositeQuery, {
                    selectedSectionTitles: [],
                    memeFilter
                  })
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
  keywordWithSections: Keyword | KeywordWithSections,
  codeCell: CodeCell
): void {
  // Get output element from the CodeCell
  const outputElement = getOutputElementFromCodeCell(codeCell);
  let outputWrapper: HTMLElement | null = null;

  const hasComposition = (keywordWithSections.query as KeywordWithComposition)
    ?.composition;
  const keyword: KeywordWithComposition = hasComposition
    ? (keywordWithSections.query as KeywordWithComposition)
    : {
        composition: Composition.And,
        keyword: keywordWithSections as Keyword
      };

  const kws = keywordWithSections as KeywordWithSections;
  const lastSelectionResult: SectionSelectionResult | null = kws.scope
    ? {
        scope: kws.scope,
        range: kws.range,
        sections: kws.sections
          ? kws.sections.map(title => ({
              title,
              startIndex: 0,
              endIndex: 0,
              cells: []
            }))
          : undefined
      }
    : null;

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
          keyword={keyword}
          lastSelectionResult={lastSelectionResult}
          memeFilter={kws.memeFilter}
          onClosed={(
            inserted: boolean,
            latestCompositeQuery?: CompositeQuery,
            insertedContent?: InsertedContent
          ) => {
            // Use the latest composite query if available, otherwise fall back to original keyword
            const keywordToUse = latestCompositeQuery
              ? getKeywordFromCompositeQuery(latestCompositeQuery)
              : keyword || {};

            // Convert keyword to YAML and set as cell source
            let yamlLines: string[] = ['%%nbsearch'];
            const yamlData: KeywordWithSections = {
              query: keywordToUse,
              scope: insertedContent?.scope,
              range: insertedContent?.range,
              sections: insertedContent?.selectedSectionTitles,
              memeFilter: insertedContent?.memeFilter
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
