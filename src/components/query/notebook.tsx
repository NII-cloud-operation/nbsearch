import React, { useCallback, useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';

import { FieldsQuery, CompositeQuery } from './fields';
import { SolrQuery } from './base';
import { RawSolrQuery } from './solr';
import { IndexedColumnId } from '../result/result';

enum TabIndex {
  Fields,
  Solr
}

export type QueryProps = {
  onChange?: (query: SolrQuery, compositeQuery?: CompositeQuery) => void;
  fields?: IndexedColumnId[];
  initialFieldsValue?: CompositeQuery;
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
  fields,
  initialFieldsValue
}: QueryProps): JSX.Element {
  const [solrQuery, setSolrQuery] = useState<SolrQuery>({
    queryString: '_text_:*'
  });
  const [fieldsQuery, setFieldsQuery] = useState<SolrQuery>({
    queryString: '_text_:*'
  });
  const [fieldsCompositeQuery, setFieldsCompositeQuery] = useState<
    CompositeQuery | undefined
  >(undefined);
  const [tabIndex, setTabIndex] = useState<TabIndex>(TabIndex.Fields);

  const solrChanged = useCallback(
    (query: SolrQuery) => {
      setSolrQuery(query);
      if (!onChange) {
        return;
      }
      onChange(query);
    },
    [onChange]
  );
  const fieldsChanged = useCallback(
    (query: SolrQuery, compositeQuery: CompositeQuery) => {
      setFieldsQuery(query);
      setFieldsCompositeQuery(compositeQuery);
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
    [fieldsQuery, solrQuery, onChange]
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
          initialValue={initialFieldsValue}
        />
      </TabPanel>
      <TabPanel id={TabIndex.Solr} value={tabIndex}>
        <RawSolrQuery onChange={solrChanged} query={solrQuery.queryString} />
      </TabPanel>
    </Box>
  );
}
