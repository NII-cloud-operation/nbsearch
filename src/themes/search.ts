import { createTheme } from '@mui/material';

export const theme = createTheme({
  typography: {
    fontFamily:
      "system-ui, -apple-system, blinkmacsystemfont, 'Segoe UI', helvetica, arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
    fontSize: 12,
    button: {
      textTransform: 'none'
    }
  },
  spacing: 2
});
