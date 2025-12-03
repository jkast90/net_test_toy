// src/utils/logger.ts
// Centralized logging utility with environment-aware controls

const isDevelopment = process.env.NODE_ENV === "development";

export type LogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "auth"
  | "workspace"
  | "api";

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  auth: (message: string, ...args: any[]) => void;
  workspace: (message: string, ...args: any[]) => void;
  api: (message: string, ...args: any[]) => void;
}

export const logger: Logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  // Contextual loggers for specific components
  auth: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[AUTH] ${message}`, ...args);
    }
  },

  workspace: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[WORKSPACE] ${message}`, ...args);
    }
  },

  api: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[API] ${message}`, ...args);
    }
  },
};

export default logger;
