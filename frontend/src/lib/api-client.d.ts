// Type definitions for api-client.js

export interface ApiClient {
  fetch(url: string, options?: RequestInit): Promise<any>;
}

export function createApiClient(): ApiClient;
export function useApiClient(): ApiClient;
export function apiCall(url: string, options?: RequestInit, orgId?: string | null): Promise<any>;