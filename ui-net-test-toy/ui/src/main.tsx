import * as React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeTheme } from "./_common/utils/themeManager";

// Initialize theme immediately to prevent flash of unstyled content
initializeTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
