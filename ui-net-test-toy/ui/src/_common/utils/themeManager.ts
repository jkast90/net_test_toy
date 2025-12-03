// Theme manager utility

// Type definitions
export interface ThemeInfo {
  name: string;
  description: string;
}

export type ThemeName =
  | "clean-blue-dark"
  | "clean-blue-light"
  | "netstream-dark"
  | "netstream-light"
  | "high-contrast-light"
  | "high-contrast-dark"
  | "forest-light"
  | "forest-dark"
  | "routeherald-dark"
  | "routeherald-light";

export interface ThemeChangedEvent extends CustomEvent {
  detail: {
    theme: ThemeName;
  };
}

export const THEMES: Record<ThemeName, ThemeInfo> = {
  "clean-blue-dark": {
    name: "Clean Blue (Dark)",
    description: "Classic blue theme with dark background",
  },
  "clean-blue-light": {
    name: "Clean Blue (Light)",
    description: "Classic blue theme with light background",
  },
  "netstream-dark": {
    name: "Netstream (Dark)",
    description: "Warm purple tones perfect for family connections",
  },
  "netstream-light": {
    name: "Netstream (Light)",
    description: "Soft cream and lavender theme for a welcoming feel",
  },
  "high-contrast-light": {
    name: "High Contrast (Light)",
    description: "High contrast theme with black text on white background",
  },
  "high-contrast-dark": {
    name: "High Contrast (Dark)",
    description: "High contrast theme with white text on black background",
  },
  "forest-light": {
    name: "Forest (Light)",
    description: "Fresh green theme with light background",
  },
  "forest-dark": {
    name: "Forest (Dark)",
    description: "Deep green theme with dark background",
  },
  "routeherald-dark": {
    name: "Route Herald (Dark)",
    description: "Professional BGP monitoring theme with dark background",
  },
  "routeherald-light": {
    name: "Route Herald (Light)",
    description: "Professional BGP monitoring theme with light background",
  },
};

export const DEFAULT_THEME: ThemeName = "routeherald-dark";

/**
 * Get the current theme from localStorage or system preference
 */
export function getCurrentTheme(): ThemeName {
  const stored = localStorage.getItem("theme") as ThemeName;
  if (stored && THEMES[stored]) {
    return stored;
  }

  // Check if user prefers light mode
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? DEFAULT_THEME : "netstream-light";
}

/**
 * Apply a theme to the document
 */
export function applyTheme(themeName: ThemeName): ThemeName {
  let validThemeName = themeName;

  if (!THEMES[themeName]) {
    console.warn(`Unknown theme: ${themeName}, falling back to default`);
    validThemeName = DEFAULT_THEME;
  }

  // Remove any existing theme classes
  document.documentElement.removeAttribute("data-theme");
  document.body.classList.remove("light"); // Remove legacy light class

  // Apply new theme
  document.documentElement.setAttribute("data-theme", validThemeName);

  // Store preference
  localStorage.setItem("theme", validThemeName);

  // Dispatch event for components that need to react to theme changes
  const event: ThemeChangedEvent = new CustomEvent("themeChanged", {
    detail: { theme: validThemeName },
  }) as ThemeChangedEvent;
  window.dispatchEvent(event);

  return validThemeName;
}

/**
 * Initialize theme on app start
 */
export function initializeTheme(): ThemeName {
  const theme = getCurrentTheme();
  applyTheme(theme);
  return theme;
}

/**
 * Check if a theme is dark
 */
export function isDarkTheme(themeName: ThemeName): boolean {
  return themeName.includes("dark");
}

/**
 * Get the opposite theme (light/dark variant)
 */
export function getOppositeTheme(themeName: ThemeName): ThemeName {
  const themes = Object.keys(THEMES) as ThemeName[];
  const baseName = themeName.replace("-dark", "").replace("-light", "");
  const isDark = isDarkTheme(themeName);

  // Find opposite variant
  const opposite = themes.find(
    (t) => t.includes(baseName) && isDarkTheme(t) !== isDark,
  );

  return opposite || (isDark ? "netstream-light" : "netstream-dark");
}
