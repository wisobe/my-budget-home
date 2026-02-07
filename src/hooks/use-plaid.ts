import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/config';
import { useMockDataSetting } from '@/contexts/MockDataContext';
import type { PlaidConnection } from '@/types';

// Mock connections for development
const mockConnections: PlaidConnection[] = [
  {
    id: '1',
    institution_id: 'ins_desjardins',
    institution_name: 'Desjardins',
    status: 'active',
    last_synced: new Date().toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

export function usePlaidConnections() {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['plaid-connections', useMockData],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockConnections, success: true };
      }
      return request<{ data: PlaidConnection[]; success: boolean }>('/plaid/connections.php');
    },
  });
}

export function useCreateLinkToken() {
  return useMutation({
    mutationFn: async () => {
      return request<{ data: { link_token: string; expiration: string }; success: boolean }>(
        '/plaid/link-token.php',
        { method: 'POST' }
      );
    },
  });
}

export function useExchangePlaidToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ publicToken, institutionId }: { publicToken: string; institutionId: string }) => {
      return request<{ data: PlaidConnection; success: boolean }>(
        '/plaid/exchange-token.php',
        {
          method: 'POST',
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: institutionId,
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSyncPlaidConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      return request<{
        data: { added: number; modified: number; removed: number; accounts_updated: number };
        success: boolean;
      }>('/plaid/sync.php', {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRemovePlaidConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      return request<{ success: boolean; message: string }>('/plaid/remove.php', {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
