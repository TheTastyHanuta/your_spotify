import { createTheme, useMediaQuery } from "@mui/material";
import { useSelector } from "react-redux";

import { selectDarkMode } from "./redux/modules/user/selector";

export const useTheme = () => {
  const dark = useSelector(selectDarkMode);
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const isDark = dark === "dark" || (dark === "follow" && prefersDarkMode);

  const theme = createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: { main: isDark ? "#f3f1f5" : "#1b1a1e" },
      background: {
        default: isDark ? "#0b0b0d" : "#faf9f7",
        paper: isDark ? "#141317" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f3f1f5" : "#1b1a1e",
        secondary: isDark ? "#a8a3b0" : "#5f5a66",
      },
      divider: isDark ? "#24232a" : "#e7e3de",
    },
    typography: {
      fontFamily: '"Bricolage Grotesque Variable", system-ui, sans-serif',
      fontSize: 14,
    },
    components: {
      MuiTab: {
        defaultProps: {
          disableRipple: true,
          focusRipple: false,
          disableFocusRipple: true,
          disableTouchRipple: true,
        },
        styleOverrides: {
          root: {
            textTransform: "none",
            minHeight: 36,
            minWidth: 0,
            padding: "6px 2px",
            marginRight: 18,
            fontSize: 14,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 36, backgroundColor: "transparent" },
          indicator: { backgroundColor: "var(--tint)", height: 2 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: "none", borderRadius: 6 } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            padding: "4px 12px",
            fontSize: 13,
            lineHeight: 1.4,
          },
        },
      },
      MuiMenu: {
        styleOverrides: { paper: { border: "1px solid var(--line)" } },
      },
      MuiDialog: {
        styleOverrides: { paper: { border: "1px solid var(--line)" } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "unset" } } },
      MuiCheckbox: {
        styleOverrides: { root: { color: "var(--text) !important" } },
      },
      MuiSkeleton: { styleOverrides: { rectangular: { borderRadius: "6px" } } },
    },
    shape: { borderRadius: 6 },
  });
  return theme;
};
