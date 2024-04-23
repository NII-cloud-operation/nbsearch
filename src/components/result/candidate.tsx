import React from 'react';
import { Box, Button } from '@mui/material';
import { Difference, Check, Close } from '@mui/icons-material';

export enum CandidateViewMode {
  Update,
  Insert
}

export type CandidateViewProps = {
  mode: CandidateViewMode;
  content: string;
  onDiffOpen?: () => void;
  onApply?: () => void;
  onCancel?: () => void;
};

export function CandidateView({
  mode,
  content,
  onDiffOpen,
  onApply,
  onCancel
}: CandidateViewProps) {
  return (
    <Box className="nbsearch-candidate-root">
      <Box className="nbsearch-candidate-toolbar">
        <Box className="nbsearch-candidate-mode">
          {mode === CandidateViewMode.Insert
            ? 'Insert New Cell'
            : 'Update Current Cell'}
        </Box>
        {mode === CandidateViewMode.Update && (
          <Button onClick={onDiffOpen} variant="contained">
            <Difference />
            Show Difference
          </Button>
        )}
        <Button onClick={onApply} variant="contained">
          <Check />
          Apply
        </Button>
        <Button
          onClick={onCancel}
          className="nbsearch-candidate-cancel"
          variant="contained"
        >
          <Close />
          Cancel
        </Button>
      </Box>
      <Box className="nbsearch-candidate-content">
        <pre>{content}</pre>
      </Box>
    </Box>
  );
}
