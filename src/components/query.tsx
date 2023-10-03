import React, { useCallback, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
} from '@mui/material';

import { SolrQuery } from "./solr-query";
import { CompositeQuery, FieldsQuery } from './fields-query';


enum TabIndex {
  Fields,
  Solr,
};


export type QueryProps = {
  onChange?: (query: string | null) => void;
};


type TabPanelProps = {
  children?: React.ReactNode;
  id: TabIndex;
  value: TabIndex;
}


function TabPanel(props: TabPanelProps): JSX.Element {
  const { value, id, children } = props;
  return <div
    role='tabpanel'
    hidden={value !== id}
    id={`simple-tabpanel-${id}`}
    aria-labelledby={`simple-tab-${id}`}
  >
    {value === id && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
}


export function Query(props: QueryProps): JSX.Element {
  const { onChange } = props;
  const [solrQuery, setSolrQuery] = useState<string | undefined>('_text_: *');
  const [tabIndex, setTabIndex] = useState<TabIndex>(TabIndex.Fields);

  const solrChanged = useCallback((query: string | null) => {
    setSolrQuery(query || undefined);
    if (!onChange) {
      return;
    }
    onChange(query);
  }, [onChange]);
  const fieldsChanged = useCallback((query: CompositeQuery) => {
    const solrQuery = query.fields
      .map((field) => `${field.target}: ${field.query}`)
      .join(` ${query.composition} `);
    console.log('TEST', solrQuery);
    setSolrQuery(solrQuery);
    if (!onChange) {
      return;
    }
    onChange(solrQuery);
  }, [onChange]);

  return <Box>
    <Tabs
      value={tabIndex}
      onChange={(event: React.SyntheticEvent, tabIndex: any) => setTabIndex(tabIndex as TabIndex)}
    >
      <Tab
        value={ TabIndex.Fields }
        label='Search by fields'
        id={`simple-tab-${TabIndex.Fields}`}
        aria-controls={`simple-tabpanel-${TabIndex.Fields}`}
      />
      <Tab
        value={ TabIndex.Solr }
        label='Solr query'
        id={`simple-tab-${TabIndex.Solr}`}
        aria-controls={`simple-tabpanel-${TabIndex.Solr}`}
      />
    </Tabs>
    <TabPanel id={TabIndex.Fields} value={tabIndex}>
      <FieldsQuery
        onChange={fieldsChanged}
      />
    </TabPanel>
    <TabPanel id={TabIndex.Solr} value={tabIndex}>
      <SolrQuery
        onChange={solrChanged}
        query={solrQuery}
      />
    </TabPanel>
  </Box>;
}