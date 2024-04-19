import React, { ChangeEvent, useCallback, useState } from 'react';

import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import { IndexedColumnId } from '../result/result';
import { SolrQuery } from './base';

export enum Composition {
  And = 'AND',
  Or = 'OR'
}

type CompositionMode = {
  type: Composition;
  label: string;
};

type Field = {
  id: IndexedColumnId;
  label: string;
};

const COMPOSITIONS: CompositionMode[] = [
  {
    type: Composition.And,
    label: 'All conditions'
  },
  {
    type: Composition.Or,
    label: 'Any of the conditions'
  }
];

const FIELDS: Field[] = [
  {
    id: IndexedColumnId.FullText,
    label: 'Full text search'
  },
  {
    id: IndexedColumnId.Owner,
    label: 'Owner name'
  },
  {
    id: IndexedColumnId.Path,
    label: 'File name'
  },
  {
    id: IndexedColumnId.Server,
    label: 'Server URL'
  },
  {
    id: IndexedColumnId.Cells,
    label: 'Text in cell'
  },
  {
    id: IndexedColumnId.Outputs,
    label: 'Output of cell'
  },
  {
    id: IndexedColumnId.CellMemes,
    label: 'MEME of cell'
  }
  /*
  ['lc_notebook_meme__current', 'MEME of notebook'],
  ['signature_notebook_path', 'File path'],
  ['source__code', 'Text in code cell'],
  ['source__markdown', 'Text in markdown cell'],
  ['source__markdown__operation_note', 'Text in Operation Note'],
  ['source__markdown__todo', '`TODO` in markdown cell'],
  ['source__markdown__heading', 'Header in markdown cell'],
  ['source__markdown__url', 'URL in markdown cell'],
  ['source__markdown__code', 'Code in markdown cell'],
  ['outputs__stdout', 'STDOUT of cell'],
  ['outputs__stderr', 'STDERR of cell'],
  ['outputs__result_plain', 'Result Text of cell'],
  ['outputs__result_html', 'Result HTML of cell'],
  */
];

type FieldQuery = {
  target: IndexedColumnId;
  query: string;
};

export type CompositeQuery = {
  composition: Composition;
  fields: FieldQuery[];
};

export type FieldsQueryProps = {
  onChange?: (query: SolrQuery) => void;
};

export function FieldsQuery(props: FieldsQueryProps): JSX.Element {
  const { onChange } = props;
  const [composition, setComposition] = useState<Composition>(Composition.And);
  const [fieldQueries, setFieldQueries] = useState<FieldQuery[]>([
    {
      target: IndexedColumnId.FullText,
      query: '*'
    }
  ]);
  const notifyQueryChange = useCallback(
    (newQueries: FieldQuery[], composition: Composition) => {
      const solrQuery = newQueries
        .map(field => `${field.target}:${field.query}`)
        .join(` ${composition} `);
      if (!onChange) {
        return;
      }
      onChange({
        queryString: solrQuery
      });
    },
    [onChange]
  );

  const updateFieldQueriesTarget = useCallback(
    (index: number, target: IndexedColumnId) => {
      const newQueries: FieldQuery[] = fieldQueries.map(q =>
        Object.assign({}, q)
      );
      newQueries[index].target = target;
      setFieldQueries(newQueries);
      notifyQueryChange(newQueries, composition);
    },
    [fieldQueries, composition]
  );
  const updateFieldQueriesQuery = useCallback(
    (index: number, value: string) => {
      const newQueries: FieldQuery[] = fieldQueries.map(q =>
        Object.assign({}, q)
      );
      newQueries[index].query = value;
      setFieldQueries(newQueries);
      notifyQueryChange(newQueries, composition);
    },
    [fieldQueries, composition]
  );
  const deleteFieldQueries = useCallback(
    (index: number) => {
      const newQueries: FieldQuery[] = fieldQueries.map(q =>
        Object.assign({}, q)
      );
      const removedQueries = newQueries.splice(index, 1);
      setFieldQueries(removedQueries);
      notifyQueryChange(removedQueries, composition);
    },
    [fieldQueries, composition]
  );
  const addFieldQueries = useCallback(() => {
    const newQueries: FieldQuery[] = fieldQueries.map(q =>
      Object.assign({}, q)
    );
    newQueries.push({
      target: IndexedColumnId.FullText,
      query: '*'
    });
    setFieldQueries(newQueries);
    notifyQueryChange(newQueries, composition);
  }, [fieldQueries, composition]);
  const compositionChanged = useCallback(
    (event: SelectChangeEvent) => {
      const changed = event.target.value as Composition;
      setComposition(changed);
      notifyQueryChange(fieldQueries, changed);
    },
    [fieldQueries]
  );

  return (
    <Box>
      <Box>
        <Select value={composition} onChange={compositionChanged}>
          {COMPOSITIONS.map(composition => (
            <MenuItem value={composition.type}>{composition.label}</MenuItem>
          ))}
        </Select>{' '}
        are satisfied
      </Box>
      <Box sx={{ p: '0.5em' }}>
        {fieldQueries.map((query, index) => {
          return (
            <Box key={index} sx={{ p: '0.5em' }}>
              <Select
                value={query.target}
                onChange={(event: SelectChangeEvent) =>
                  updateFieldQueriesTarget(
                    index,
                    event.target.value as IndexedColumnId
                  )
                }
                sx={{ marginRight: '0.5em' }}
              >
                {FIELDS.map(field => (
                  <MenuItem value={field.id}>{field.label}</MenuItem>
                ))}
              </Select>
              <TextField
                label="Query"
                helperText="Solr Query: e.g. *"
                defaultValue={query.query}
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
                ) => updateFieldQueriesQuery(index, event.target.value)}
              />
              <Button onClick={() => deleteFieldQueries(index)}>
                <DeleteIcon />
              </Button>
            </Box>
          );
        })}
        <Button onClick={() => addFieldQueries()}>
          <AddIcon />
          Add Condition
        </Button>
      </Box>
    </Box>
  );
}
