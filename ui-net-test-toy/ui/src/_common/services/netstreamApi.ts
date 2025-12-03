// Stub file for netstreamApi
// TODO: Implement proper API functions

export const CURRENT_USER_ID = 1;

export interface WishlistItem {
  id: number;
  description: string;
  wishee_id: number;
  link?: string;
  price?: number;
  priority?: string;
  category?: string;
  size?: string | null;
  quantity?: number;
  claimed_by?: string;
  claim_status?: string;
  owner?: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export const netstreamApi = {
  // Add stub methods as needed
};

export const profilesApi = {
  // Add stub methods as needed
};

export const bugReportsApi = {
  // Add stub methods as needed
  create: async (data: any) => {
    console.log('Bug report:', data);
    return { success: true };
  }
};

export const usersApi = {
  // Add stub methods as needed
};
