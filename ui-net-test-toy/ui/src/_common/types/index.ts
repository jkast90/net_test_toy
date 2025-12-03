// src/types/index.ts
// Type definitions for Netstream application

// ===========================
// Common Base Types
// ===========================

export interface BaseEntity {
  id: number;
  created_at?: string;
  updated_at?: string;
}

export interface User extends BaseEntity {
  email: string;
  name?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme?: string;
  language?: string;
  notifications?: boolean;
  autoSave?: boolean;
  [key: string]: any;
}

// ===========================
// API Response Types
// ===========================

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  status?: "success" | "error";
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, any>;
  status?: number;
}

// ===========================
// Redux State Types
// ===========================

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface EntityState<T> extends LoadingState {
  items: T[];
  selectedItem: T | null;
}

// ===========================
// Dialog/Modal Types
// ===========================

export interface DialogState {
  isOpen: boolean;
  data?: any;
  loading?: boolean;
  error?: string | null;
}

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "danger" | "warning" | "info";
}

// ===========================
// Form Types
// ===========================

export interface FormField {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "textarea"
    | "select"
    | "checkbox"
    | "number"
    | "url"
    | "date";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface FormData {
  [key: string]: any;
}

export interface FormErrors {
  [key: string]: string;
}

// ===========================
// Utility Types
// ===========================

export type SortDirection = "asc" | "desc";
export type SortField = "name" | "created_at" | "updated_at" | "sort_order";

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

export type ViewMode = "grid" | "list" | "compact";
export type ThemeMode = "light" | "dark" | "auto";

// ===========================
// Component Props Types
// ===========================

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends ComponentProps {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export interface InputProps extends ComponentProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

// ===========================
// Event Types
// ===========================

export interface CustomEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
}

export interface KeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

// ===========================
// Storage Types
// ===========================

export interface StorageItem<T = any> {
  key: string;
  value: T;
  timestamp?: number;
  expires?: number;
}

// ===========================
// Export all types from sub-modules
// ===========================

// Re-export types from utility modules
export type {
  LogLevel,
  NormalizedGroup,
  NormalizedWorkspace,
  NormalizedTile,
  SearchableItem,
  StoredWorkspace,
  RawStoredWorkspace,
  ReminderColor,
  ThemeName,
  ThemeInfo,
  TileImageMap,
  ImageModule,
} from "../utils";

// Re-export types from constants
export type {
  StorageKey,
  ApiEndpoint,
  ThemeOption,
  GroupType,
  SupportedImageExtension,
  HttpMethod,
} from "../constants";

// Re-export Redux types
export type { RootState, AppDispatch } from "../store/store";

// Re-export component types
export type { Banner } from "./slices/bannerSlice";

// Re-export NetFlow types
export type {
  NetFlowStats,
  Flow,
  TopTalker,
  Conversation,
  TriggerConditions,
  TriggerAction,
  Trigger,
  TriggeredEvent,
} from "./netflow";

// Re-export BMP types
export type { BMPPeer, BMPRoute } from "./bmp";
