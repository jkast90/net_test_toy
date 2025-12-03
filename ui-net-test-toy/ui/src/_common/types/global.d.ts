// src/types/global.d.ts
// Global type declarations

// ===========================
// Window & Global Extensions
// ===========================

declare global {
  interface Window {
    // Custom events
    dispatchEvent(event: CustomEvent): boolean;

    // Custom properties that might be added by libraries or custom code
    settingsUpdated?: () => void;

    // Development/debugging tools
    __REDUX_DEVTOOLS_EXTENSION__?: () => any;
  }

  // Node.js environment variables
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      REACT_APP_API_URL?: string;
      REACT_APP_COGNITO_DOMAIN?: string;
      REACT_APP_COGNITO_CLIENT_ID?: string;
      PUBLIC_URL?: string;
    }
  }
}

// ===========================
// Module Declarations
// ===========================

// For importing CSS modules
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// For importing regular CSS files
declare module "*.css" {
  const css: string;
  export default css;
}

// For importing SCSS modules
declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

// For importing regular SCSS files
declare module "*.scss" {
  const css: string;
  export default css;
}

// For importing images
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  import * as React from "react";

  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;

  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.ico" {
  const src: string;
  export default src;
}

// For importing fonts
declare module "*.woff" {
  const src: string;
  export default src;
}

declare module "*.woff2" {
  const src: string;
  export default src;
}

declare module "*.ttf" {
  const src: string;
  export default src;
}

declare module "*.eot" {
  const src: string;
  export default src;
}

// For importing JSON files
declare module "*.json" {
  const content: { [key: string]: any };
  export default content;
}

// For importing text files
declare module "*.txt" {
  const content: string;
  export default content;
}

declare module "*.md" {
  const content: string;
  export default content;
}

// ===========================
// Third-party Library Types
// ===========================

// If using libraries without TypeScript support
declare module "some-untyped-library" {
  export function someFunction(param: string): any;
  export const someConstant: any;
}

// ===========================
// Vite-specific Types
// ===========================

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_APP_TITLE: string;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  glob(pattern: string, options?: { eager?: boolean }): Record<string, any>;
}

// ===========================
// Custom Event Types
// ===========================

interface CustomEventMap {
  settingsUpdated: CustomEvent<any>;
  themeChanged: CustomEvent<{ theme: string }>;
}

declare global {
  interface WindowEventMap extends CustomEventMap {}
}

// ===========================
// React Extensions
// ===========================

declare namespace React {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

// ===========================
// Utility Types
// ===========================

// Make all properties optional recursively
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Make all properties required recursively
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

// Extract keys of a type that are functions
export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

// Extract keys of a type that are not functions
export type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

// Create a type with only the function properties
export type FunctionProperties<T> = Pick<T, FunctionKeys<T>>;

// Create a type with only the non-function properties
export type NonFunctionProperties<T> = Pick<T, NonFunctionKeys<T>>;

export {};
