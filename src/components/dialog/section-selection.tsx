import React, { useState } from 'react';
import { Dialog, ReactWidget, showDialog } from '@jupyterlab/apputils';
import {
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  Button,
  Stack,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Divider
} from '@mui/material';

export type NotebookSection = {
  title: string;
  startIndex: number;
  endIndex: number;
  cells: any[];
};

export type Scope = 'cell' | 'section' | 'notebook';
export type Range = 'before' | 'after' | 'all';

export type SectionSelectionResult = {
  scope: Scope;
  range?: Range;
  sections?: NotebookSection[];
};

interface ISectionSelectionWidgetProps {
  sections: NotebookSection[];
  onResultChange: (result: SectionSelectionResult) => void;
  initialResult?: SectionSelectionResult;
  hasMeme: boolean;
}

function SectionSelectionComponent({
  sections,
  onResultChange,
  initialResult,
  hasMeme
}: ISectionSelectionWidgetProps): JSX.Element {
  const [scope, setScope] = useState<Scope>(initialResult?.scope || 'cell');
  const [range, setRange] = useState<Range>(initialResult?.range || 'after');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    if (initialResult?.sections) {
      return new Set(
        initialResult.sections
          .map(s => sections.findIndex(sec => sec.title === s.title))
          .filter(i => i !== -1)
      );
    }
    return new Set(sections.map((_, index) => index));
  });

  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
    // Reset range to 'after' when changing scope
    const newRange: Range = 'after';
    setRange(newRange);
    updateResult(newScope, newRange, selectedIndices);
  };

  const handleRangeChange = (newRange: Range) => {
    setRange(newRange);
    updateResult(scope, newRange, selectedIndices);
  };

  const handleCheckboxChange = (index: number, checked: boolean) => {
    const newSelectedIndices = new Set(selectedIndices);
    if (checked) {
      newSelectedIndices.add(index);
    } else {
      newSelectedIndices.delete(index);
    }
    setSelectedIndices(newSelectedIndices);
    updateResult(scope, range, newSelectedIndices);
  };

  const handleSelectAll = () => {
    const allIndices = new Set(sections.map((_, index) => index));
    setSelectedIndices(allIndices);
    updateResult(scope, range, allIndices);
  };

  const handleDeselectAll = () => {
    const newSelectedIndices = new Set<number>();
    setSelectedIndices(newSelectedIndices);
    updateResult(scope, range, newSelectedIndices);
  };

  const updateResult = (
    currentScope: Scope,
    currentRange: Range,
    currentSelectedIndices: Set<number>
  ) => {
    const result: SectionSelectionResult = {
      scope: currentScope
    };

    if (currentScope !== 'cell') {
      result.range = currentRange;
    }

    if (currentScope === 'notebook' && currentRange === 'all') {
      result.sections = Array.from(currentSelectedIndices).map(
        i => sections[i]
      );
    }

    onResultChange(result);
  };

  const showRangeSelection = scope !== 'cell';
  const showSectionList = scope === 'notebook' && range === 'all';

  return (
    <Box className="section-selection-root" sx={{ minWidth: 400 }}>
      {/* Scope Selection */}
      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <FormLabel component="legend">
          Select Scope
        </FormLabel>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          Choose how much to insert based on the search result cell
        </Typography>
        <RadioGroup
          value={scope}
          onChange={e => handleScopeChange(e.target.value as Scope)}
        >
          <FormControlLabel
            value="cell"
            control={<Radio />}
            label="Single cell"
          />
          <FormControlLabel
            value="section"
            control={<Radio />}
            label="Containing section"
            disabled={!hasMeme}
          />
          <FormControlLabel
            value="notebook"
            control={<Radio />}
            label="Entire notebook"
            disabled={!hasMeme}
          />
        </RadioGroup>
      </FormControl>

      {/* Range Selection */}
      {showRangeSelection && (
        <>
          <Divider sx={{ mt: 0, mb: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">
              Select Range
            </FormLabel>
            <RadioGroup
              value={range}
              onChange={e => handleRangeChange(e.target.value as Range)}
            >
              <FormControlLabel
                value="before"
                control={<Radio />}
                label="Before this cell (inclusive)"
              />
              <FormControlLabel
                value="after"
                control={<Radio />}
                label="After this cell (inclusive)"
              />
              <FormControlLabel
                value="all"
                control={<Radio />}
                label="All"
              />
            </RadioGroup>
          </FormControl>
        </>
      )}

      {/* Section List */}
      {showSectionList && (
        <>
          <Divider sx={{ mt: 0, mb: 2 }} />
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">
              Select Sections
            </FormLabel>
            <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
              <Button size="small" variant="outlined" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleDeselectAll}
              >
                Deselect All
              </Button>
            </Stack>
            <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
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
                        onChange={e =>
                          handleCheckboxChange(index, e.target.checked)
                        }
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
          </FormControl>
        </>
      )}
    </Box>
  );
}

class SectionSelectionWidget extends ReactWidget {
  private sections: NotebookSection[];
  private result: SectionSelectionResult;
  private hasMeme: boolean;

  constructor(sections: NotebookSection[], initialResult: SectionSelectionResult | null, hasMeme: boolean) {
    super();
    this.addClass('section-selection-widget');
    this.sections = sections;
    this.hasMeme = hasMeme;
    this.result = initialResult || {
      scope: 'cell'
    };
  }

  render(): JSX.Element {
    const handleResultChange = (result: SectionSelectionResult) => {
      this.result = result;
    };
    return (
      <SectionSelectionComponent
        sections={this.sections}
        onResultChange={handleResultChange}
        initialResult={this.result}
        hasMeme={this.hasMeme}
      />
    );
  }

  getResult(): SectionSelectionResult {
    return this.result;
  }
}

export async function showSectionSelectionDialog(
  sections: NotebookSection[],
  hasMeme: boolean,
  initialResult: SectionSelectionResult | null
): Promise<SectionSelectionResult | null> {
  const widget = new SectionSelectionWidget(sections, initialResult, hasMeme);

  const dialogResult = await showDialog({
    title: 'Select Range to Add',
    body: widget,
    buttons: [
      Dialog.cancelButton({ label: 'Cancel' }),
      Dialog.okButton({ label: 'Add' })
    ]
  });

  const selectionResult = widget.getResult();
  widget.dispose();

  if (dialogResult.button.accept) {
    return selectionResult;
  }
  return null;
}
