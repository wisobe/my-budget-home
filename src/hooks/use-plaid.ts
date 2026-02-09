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
    plaid_environment: 'sandbox',
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
  const { useMockData, plaidEnvironment } = useMockDataSetting();
  return useQuery({
    queryKey: ['plaid-connections', useMockData, plaidEnvironment],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockConnections.filter(c => c.plaid_environment === plaidEnvironment), success: true };
      }
      return request<{ data: PlaidConnection[]; success: boolean }>(
        `/plaid/connections.php?plaid_environment=${plaidEnvironment}`
      );
    },
  });
}

export function useCreateLinkToken() {
  const { plaidEnvironment } = useMockDataSetting();

  return useMutation({
    mutationFn: async () => {
      return request<{ data: { link_token: string; expiration: string; environment: string }; success: boolean }>(
        '/plaid/link-token.php',
        {
          method: 'POST',
          body: JSON.stringify({ plaid_environment: plaidEnvironment }),
        }
      );
    },
  });
}

export function useExchangePlaidToken() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = useMockDataSetting();

  return useMutation({
    mutationFn: async ({ publicToken, institutionId }: { publicToken: string; institutionId: string }) => {
      return request<{ data: PlaidConnection; success: boolean }>(
        '/plaid/exchange-token.php',
        {
          method: 'POST',
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: institutionId,
            plaid_environment: plaidEnvironment,
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

/**
 * Sync all Plaid connections sequentially.
 * Returns totals for added/modified/removed transactions.
 */
export function useSyncAllConnections() {
  const queryClient = useQueryClient();
  const { useMockData, plaidEnvironment } = useMockDataSetting();

  return useMutation({
    mutationFn: async () => {
      if (useMockData) {
        return { added: 0, modified: 0, removed: 0, accounts_updated: 0 };
      }

      // Fetch current connections for the active environment
      const connectionsResult = await request<{ data: PlaidConnection[]; success: boolean }>(
        `/plaid/connections.php?plaid_environment=${plaidEnvironment}`
      );

      const connections = connectionsResult.data || [];
      if (connections.length === 0) {
        throw new Error('No bank connections found. Connect a bank first.');
      }

      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;
      let totalAccounts = 0;

      // Sync each connection sequentially (avoid rate limits)
      for (const connection of connections) {
        const result = await request<{
          data: { added: number; modified: number; removed: number; accounts_updated: number };
          success: boolean;
        }>('/plaid/sync.php', {
          method: 'POST',
          body: JSON.stringify({ connection_id: connection.id }),
        });

        totalAdded += result.data.added;
        totalModified += result.data.modified;
        totalRemoved += result.data.removed;
        totalAccounts += result.data.accounts_updated;
      }

      return {
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved,
        accounts_updated: totalAccounts,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
