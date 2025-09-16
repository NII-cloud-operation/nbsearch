import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';

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

enum HelperTextType {
  Number = 'Number',
  DateTime = 'DateTime'
}

type Field = {
  id: IndexedColumnId;
  label: string;
  helperTextType?: HelperTextType;
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

const helperTexts: { [key in HelperTextType]: string } = {
  [HelperTextType.Number]: 'Solr Number Query: e.g. [1 TO 10]',
  [HelperTextType.DateTime]: 'Solr DateTime Query: e.g. [NOW-1YEAR TO NOW]'
};

export const ALL_FIELDS: Field[] = [
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
    label: 'Path'
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
  },
  {
    id: IndexedColumnId.Modified,
    label: 'Modified time',
    helperTextType: HelperTextType.DateTime
  },
  {
    id: IndexedColumnId.Executed,
    label: 'Executed time',
    helperTextType: HelperTextType.DateTime
  },
  {
    id: IndexedColumnId.EstimatedModifiedTime,
    label: 'Executed/Modified',
    helperTextType: HelperTextType.DateTime
  },
  {
    id: IndexedColumnId.CurrentMeme,
    label: 'MEME of notebook'
  },
  {
    id: IndexedColumnId.SignatureNotebookPath,
    label: 'File path'
  },
  {
    id: IndexedColumnId.SourceCode,
    label: 'Text in code cell'
  },
  {
    id: IndexedColumnId.SourceMarkdown,
    label: 'Text in markdown cell'
  },
  {
    id: IndexedColumnId.OperationNote,
    label: 'Text in Operation Note'
  },
  {
    id: IndexedColumnId.NumberOfHeaders,
    label: 'Number of headers in markdown cell',
    helperTextType: HelperTextType.Number
  },
  {
    id: IndexedColumnId.SourceMarkdownTODO,
    label: 'TODO in markdown cell'
  },
  {
    id: IndexedColumnId.SourceMarkdownHeading,
    label: 'Header in markdown cell'
  },
  {
    id: IndexedColumnId.SourceMarkdownURL,
    label: 'URL in markdown cell'
  },
  {
    id: IndexedColumnId.SourceMarkdownCode,
    label: 'Code in markdown cell'
  },
  {
    id: IndexedColumnId.SourceMarkdownHashtags,
    label: 'Hashtags in markdown cell'
  },
  {
    id: IndexedColumnId.Stdout,
    label: 'STDOUT of cell'
  },
  {
    id: IndexedColumnId.Stderr,
    label: 'STDERR of cell'
  },
  {
    id: IndexedColumnId.ResultPlain,
    label: 'Result Text of cell'
  },
  {
    id: IndexedColumnId.ResultHTML,
    label: 'Result HTML of cell'
  }
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
  onChange?: (query: SolrQuery, compositeQuery: CompositeQuery) => void;
  onSearch?: () => void;
  fields?: IndexedColumnId[];
  value?: CompositeQuery;
};

export function FieldsQuery({
  onChange,
  onSearch,
  fields: customFields,
  value
}: FieldsQueryProps): JSX.Element {

  // For controlled component, always use value from props
  // If no value provided, use defaults
  const composition = value?.composition ?? Composition.And;
  const fieldQueries = value?.fields ?? [
    {
      target: IndexedColumnId.FullText,
      query: '*'
    }
  ];

  const [selectedField, setSelectedField] = useState<Field | null>(null);


  const fields = useMemo(() => {
    const splittedCustomFields = customFields
      ?.map(field => {
        if (!field.includes('|')) {
          return [field];
        }
        const ids = field.split('|');
        return ids as IndexedColumnId[];
      })
      .reduce((acc, val) => acc.concat(val), []);
    return [IndexedColumnId.FullText].concat(splittedCustomFields || []);
  }, [customFields]);
  const FIELDS = useMemo(() => {
    if (fields === undefined) {
      return ALL_FIELDS;
    }
    const fields_ = fields.map(
      field => ALL_FIELDS.find(f => f.id === field) as Field | undefined
    );
    if (fields_.some(field => field === undefined)) {
      throw new Error(
        `Invalid field: ${fields_
          .map(f => (f === undefined ? 'null' : JSON.stringify(f)))
          .join(',')}`
      );
    }
    return fields_.filter((field): field is Field => field !== undefined);
  }, [fields]);
  const defaultField = useMemo(() => {
    return FIELDS.find(
      field => !fieldQueries.map(fq => fq.target).includes(field.id)
    );
  }, [fieldQueries, FIELDS]);

  const notifyQueryChange = useCallback(
    (newQueries: FieldQuery[], composition: Composition) => {
      const solrQuery = newQueries
        .map(field => `${field.target}:${field.query}`)
        .join(` ${composition} `);
      const compositeQuery: CompositeQuery = {
        composition,
        fields: newQueries
      };
      if (!onChange) {
        return;
      }
      onChange(
        {
          queryString: solrQuery
        },
        compositeQuery
      );
    },
    [onChange]
  );
  const updateFieldQueriesQuery = useCallback(
    (index: number, newValue: string) => {
      const newQueries: FieldQuery[] = fieldQueries.map((q, i) =>
        i === index ? { ...q, query: newValue } : { ...q }
      );
      notifyQueryChange(newQueries, composition);
    },
    [fieldQueries, composition, notifyQueryChange]
  );
  const deleteFieldQueries = useCallback(
    (index: number) => {
      const newQueries: FieldQuery[] = fieldQueries.filter((_, i) => i !== index);
      notifyQueryChange(newQueries, composition);
    },
    [fieldQueries, composition, notifyQueryChange]
  );
  const addFieldQueries = useCallback(() => {
    const newField = selectedField || defaultField;
    if (!newField) {
      return;
    }
    const newQueries: FieldQuery[] = [
      ...fieldQueries,
      {
        target: newField.id,
        query: '*'
      }
    ];
    setSelectedField(
      FIELDS.find(
        field =>
          !newQueries.map(fq => fq.target).includes(field.id)
      ) || null
    );
    notifyQueryChange(newQueries, composition);
  }, [fieldQueries, composition, defaultField, selectedField, FIELDS, notifyQueryChange]);
  const compositionChanged = useCallback(
    (event: SelectChangeEvent) => {
      const changed = event.target.value as Composition;
      notifyQueryChange(fieldQueries, changed);
    },
    [fieldQueries, notifyQueryChange]
  );
  const fieldChanged = useCallback(
    (event: SelectChangeEvent) => {
      const field = FIELDS.find(field => field.id === event.target.value);
      if (field === undefined) {
        throw new Error('Invalid field');
      }
      setSelectedField(field);
    },
    [FIELDS]
  );

  return (
    <Box className="nbsearch-query-fields-root">
      {fieldQueries.length > 1 && (
        <Box className="nbsearch-query-fields-composite">
          <Select value={composition} onChange={compositionChanged}>
            {COMPOSITIONS.map(composition => (
              <MenuItem value={composition.type}>{composition.label}</MenuItem>
            ))}
          </Select>{' '}
          are satisfied
        </Box>
      )}
      <Box className="nbsearch-query-fields-values">
        {fieldQueries.map((query, index) => {
          const field = FIELDS.find(field => field.id === query.target);
          return (
            <Box
              key={index}
              className="nbsearch-query-fields-value"
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: 2
              }}
            >
              <TextField
                label={field?.label}
                helperText={
                  field?.helperTextType !== undefined
                    ? helperTexts[field?.helperTextType]
                    : 'Solr Query: e.g. *'
                }
                value={query.query}
                fullWidth
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
                ) => updateFieldQueriesQuery(index, event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && onSearch) {
                    onSearch();
                  }
                }}
              />
              <Button
                onClick={() => deleteFieldQueries(index)}
                disabled={fieldQueries.length <= 1}
                sx={{ minWidth: 'auto', mt: 1 }}
              >
                <DeleteIcon />
              </Button>
            </Box>
          );
        })}
      </Box>
      {defaultField !== undefined && (
        <Box
          className="nbsearch-query-fields-add"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 1
          }}
        >
          <Button onClick={() => addFieldQueries()}>
            <AddIcon />
          </Button>
          <Select
            onChange={fieldChanged}
            value={
              selectedField === null ? defaultField?.id : selectedField?.id
            }
          >
            {FIELDS.filter(
              field => !fieldQueries.map(fq => fq.target).includes(field.id)
            ).map(field => (
              <MenuItem value={field.id}>{field.label}</MenuItem>
            ))}
          </Select>
        </Box>
      )}
    </Box>
  );
}
