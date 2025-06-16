import React, { useState } from 'react';
import { Dialog, ReactWidget, showDialog } from '@jupyterlab/apputils';
import {
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  Button,
  Stack
} from '@mui/material';

export type NotebookSection = {
  title: string;
  startIndex: number;
  endIndex: number;
  cells: any[];
};

interface ISectionSelectionWidgetProps {
  sections: NotebookSection[];
  onSelectionChange: (selectedSections: NotebookSection[]) => void;
  initialSelectedIndices?: Set<number>;
}

function SectionSelectionComponent({
  sections,
  onSelectionChange,
  initialSelectedIndices
}: ISectionSelectionWidgetProps): JSX.Element {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    initialSelectedIndices || new Set()
  );

  const handleCheckboxChange = (index: number, checked: boolean) => {
    const newSelectedIndices = new Set(selectedIndices);
    if (checked) {
      newSelectedIndices.add(index);
    } else {
      newSelectedIndices.delete(index);
    }
    setSelectedIndices(newSelectedIndices);

    const selected = Array.from(newSelectedIndices).map(i => sections[i]);
    onSelectionChange(selected);
  };

  const handleSelectAll = () => {
    const allIndices = new Set(sections.map((_, index) => index));
    setSelectedIndices(allIndices);
    onSelectionChange(sections);
  };

  const handleDeselectAll = () => {
    setSelectedIndices(new Set());
    onSelectionChange([]);
  };

  return (
    <Box sx={{ minWidth: 400 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button size="small" variant="outlined" onClick={handleSelectAll}>
          Select All
        </Button>
        <Button size="small" variant="outlined" onClick={handleDeselectAll}>
          Deselect All
        </Button>
      </Stack>
      <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
        {sections.map((section, index) => (
          <Box
            key={index}
            sx={{
              margin: '10px 0',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedIndices.has(index)}
                  onChange={e => handleCheckboxChange(index, e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle1" component="div">
                    <strong>{section.title}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {section.cells.length} cells
                  </Typography>
                </Box>
              }
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

class SectionSelectionWidget extends ReactWidget {
  private sections: NotebookSection[];
  private selectedSections: NotebookSection[] = [];
  private initialSelectedIndices?: Set<number>;

  constructor(
    sections: NotebookSection[],
    initialSelectedIndices?: Set<number>
  ) {
    super();
    this.addClass('section-selection-widget');
    this.sections = sections;
    this.initialSelectedIndices = initialSelectedIndices;
    this.selectedSections = initialSelectedIndices
      ? Array.from(initialSelectedIndices).map(index => sections[index])
      : sections; // Select all sections by default
  }

  render(): JSX.Element {
    const handleSelectionChange = (selectedSections: NotebookSection[]) => {
      this.selectedSections = selectedSections;
    };
    return (
      <SectionSelectionComponent
        sections={this.sections}
        onSelectionChange={handleSelectionChange}
        initialSelectedIndices={this.initialSelectedIndices}
      />
    );
  }
  getSelectedSections(): NotebookSection[] {
    return this.selectedSections;
  }
}

export async function showSectionSelectionDialog(
  sections: NotebookSection[],
  initialSelectedSectionTitles?: string[]
): Promise<NotebookSection[] | null> {
  // Convert initial section titles to indices
  // If no initial selection is provided or it's empty, select all sections
  const initialSelectedIndices = initialSelectedSectionTitles && initialSelectedSectionTitles.length > 0
    ? new Set(
        initialSelectedSectionTitles
          .map(title => sections.findIndex(section => section.title === title))
          .filter(index => index !== -1)
      )
    : new Set(sections.map((_, index) => index)); // Select all sections by default

  const widget = new SectionSelectionWidget(sections, initialSelectedIndices);

  const result = await showDialog({
    title: 'Select Sections to Add',
    body: widget,
    buttons: [
      Dialog.cancelButton({ label: 'Cancel' }),
      Dialog.okButton({ label: 'Add Selected Sections' })
    ]
  });
  const selectedSections = widget.getSelectedSections();
  widget.dispose();
  if (result.button.accept) {
    return selectedSections.length > 0 ? selectedSections : null;
  }
  return null;
}
