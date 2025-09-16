import React, { useCallback, useState, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';

import { FieldsQuery, CompositeQuery } from './fields';
import { SolrQuery } from './base';
import { RawSolrQuery } from './solr';
import { IndexedColumnId } from '../result/result';
import {
  parseSolrToComposite,
  compositeToSolr
} from '../../utils/query-parser';

enum TabIndex {
  Fields,
  Solr
}

export type QueryProps = {
  onChange?: (query: SolrQuery, compositeQuery?: CompositeQuery) => void;
  onSearch?: () => void;
  fields?: IndexedColumnId[];
  initialQuery?: SolrQuery;
};

type TabPanelProps = {
  children?: React.ReactNode;
  id: TabIndex;
  value: TabIndex;
};

function TabPanel(props: TabPanelProps): JSX.Element {
  const { value, id, children } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== id}
      id={`simple-tabpanel-${id}`}
      aria-labelledby={`simple-tab-${id}`}
    >
      {value === id && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function Query({
  onChange,
  onSearch,
  fields,
  initialQuery
}: QueryProps): JSX.Element {
  const [solrQuery, setSolrQuery] = useState<SolrQuery>(
    initialQuery || { queryString: '_text_:*' }
  );
  const [fieldsQuery, setFieldsQuery] = useState<SolrQuery>(
    initialQuery || { queryString: '_text_:*' }
  );
  const [fieldsCompositeQuery, setFieldsCompositeQuery] = useState<
    CompositeQuery | undefined
  >(() => {
    if (initialQuery?.queryString) {
      return parseSolrToComposite(initialQuery.queryString) || undefined;
    }
    return undefined;
  });
  const [tabIndex, setTabIndex] = useState<TabIndex>(() => {
    // If initial query can be converted to structured format, use Fields tab
    // Otherwise, use Solr tab
    if (initialQuery?.queryString) {
      const composite = parseSolrToComposite(initialQuery.queryString);
      return composite ? TabIndex.Fields : TabIndex.Solr;
    }
    return TabIndex.Fields;
  });

  // Call onChange on mount to notify parent of initial state
  useEffect(() => {
    if (onChange) {
      const currentQuery =
        tabIndex === TabIndex.Fields ? fieldsQuery : solrQuery;
      const currentComposite =
        tabIndex === TabIndex.Fields ? fieldsCompositeQuery : undefined;
      onChange(currentQuery, currentComposite);
    }
  }, []); // Only run on mount

  const solrChanged = useCallback(
    (query: SolrQuery) => {
      setSolrQuery(query);

      // Try to parse Solr query to structured format
      const compositeQuery = parseSolrToComposite(query.queryString);
      if (compositeQuery) {
        // If parseable, update fields query state
        setFieldsQuery(query);
        setFieldsCompositeQuery(compositeQuery);
      } else {
        // If not parseable, clear the composite query to avoid confusion
        // but keep the fieldsQuery as is (user might switch back)
        setFieldsCompositeQuery(undefined);
      }

      if (!onChange) {
        return;
      }
      onChange(query, compositeQuery || undefined);
    },
    [onChange]
  );
  const fieldsChanged = useCallback(
    (query: SolrQuery, compositeQuery: CompositeQuery) => {
      setFieldsQuery(query);
      setFieldsCompositeQuery(compositeQuery);

      // Also update Solr query to keep them in sync
      const solrQueryString = compositeToSolr(compositeQuery);
      setSolrQuery({ queryString: solrQueryString, q_op: query.q_op });

      if (!onChange) {
        return;
      }
      onChange(query, compositeQuery);
    },
    [onChange]
  );
  const tabChanged = useCallback(
    (event: React.SyntheticEvent, tabIndex: any) => {
      const index = tabIndex as TabIndex;
      setTabIndex(index);
      if (!onChange) {
        return;
      }
      onChange(
        index === TabIndex.Fields ? fieldsQuery : solrQuery,
        index === TabIndex.Fields ? fieldsCompositeQuery : undefined
      );
    },
    [fieldsQuery, solrQuery, onChange, fieldsCompositeQuery]
  );

  return (
    <Box>
      <Tabs value={tabIndex} onChange={tabChanged}>
        <Tab
          value={TabIndex.Fields}
          label="Search by fields"
          id={`simple-tab-${TabIndex.Fields}`}
          aria-controls={`simple-tabpanel-${TabIndex.Fields}`}
        />
        <Tab
          value={TabIndex.Solr}
          label="Solr query"
          id={`simple-tab-${TabIndex.Solr}`}
          aria-controls={`simple-tabpanel-${TabIndex.Solr}`}
        />
      </Tabs>
      <TabPanel id={TabIndex.Fields} value={tabIndex}>
        <FieldsQuery
          fields={fields}
          onChange={fieldsChanged}
          onSearch={onSearch}
          value={fieldsCompositeQuery}
        />
      </TabPanel>
      <TabPanel id={TabIndex.Solr} value={tabIndex}>
        <RawSolrQuery
          onChange={solrChanged}
          query={solrQuery.queryString}
          onSearch={onSearch}
        />
      </TabPanel>
    </Box>
  );
}
