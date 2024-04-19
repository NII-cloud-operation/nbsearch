import React from 'react';
import { Box, Button } from '@mui/material';

export type CandidateViewProps = {
  content: string;
  onDiffOpen?: () => void;
  onApply?: () => void;
};

export function CandidateView({
  content,
  onDiffOpen,
  onApply
}: CandidateViewProps) {
  return (
    <Box>
      <Button onClick={onDiffOpen}>Diff</Button>
      <Button onClick={onApply}>Apply</Button>
      <Box>
        <pre>{content}</pre>
      </Box>
    </Box>
  );
}
