import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Type definitions
export interface SearchResult {
  id: number;
  type: "link" | "note" | "group";
  title: string;
  description?: string;
  url?: string;
  content?: string;
  workspaceId?: number;
  groupId?: number;
}

export interface SearchFilters {
  showLinks: boolean;
  showNotes: boolean;
  showGroups: boolean;
}

export interface SearchState {
  searchTerm: string;
  searchResults: SearchResult[];
  searchHistory: string[];
  isSearching: boolean;
  filters: SearchFilters;
  error: string | null;
}

const initialState: SearchState = {
  searchTerm: "",
  searchResults: [],
  searchHistory: [],
  isSearching: false,
  filters: {
    showLinks: true,
    showNotes: true,
    showGroups: true,
  },
  error: null,
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    setSearchResults: (state, action: PayloadAction<SearchResult[]>) => {
      state.searchResults = action.payload;
    },
    addToSearchHistory: (state, action: PayloadAction<string>) => {
      const term = action.payload;
      if (term && !state.searchHistory.includes(term)) {
        state.searchHistory.unshift(term);
        // Keep only last 10 searches
        state.searchHistory = state.searchHistory.slice(0, 10);
      }
    },
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    setIsSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<SearchFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearSearch: (state) => {
      state.searchTerm = "";
      state.searchResults = [];
      state.isSearching = false;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setSearchTerm,
  setSearchResults,
  addToSearchHistory,
  clearSearchHistory,
  setIsSearching,
  setFilters,
  clearSearch,
  setError,
} = searchSlice.actions;

export default searchSlice.reducer;
