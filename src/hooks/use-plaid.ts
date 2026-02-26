import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/config';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import type { PlaidConnection } from '@/types';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = sessionStorage.getItem('auth_token');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const err = new Error(error.message || 'Request failed') as any;
    err.plaidError = error.plaid_error || null;
    throw err;
  }

  return response.json();
}

export function usePlaidConnections() {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['plaid-connections', plaidEnvironment],
    queryFn: () =>
      request<{ data: PlaidConnection[]; success: boolean }>(
        `/plaid/connections.php?plaid_environment=${plaidEnvironment}`
      ),
  });
}

export function useCreateLinkToken() {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: () =>
      request<{ data: { link_token: string; expiration: string; environment: string }; success: boolean }>(
        '/plaid/link-token.php',
        { method: 'POST', body: JSON.stringify({ plaid_environment: plaidEnvironment }) }
      ),
  });
}

export function useExchangePlaidToken() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: ({ publicToken, institutionId }: { publicToken: string; institutionId: string }) =>
      request<{ data: PlaidConnection; success: boolean }>('/plaid/exchange-token.php', {
        method: 'POST',
        body: JSON.stringify({ public_token: publicToken, institution_id: institutionId, plaid_environment: plaidEnvironment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSyncPlaidConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      request<{ data: { added: number; modified: number; removed: number; accounts_updated: number }; success: boolean }>(
        '/plaid/sync.php',
        { method: 'POST', body: JSON.stringify({ connection_id: connectionId }) }
      ),
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
    mutationFn: (connectionId: string) =>
      request<{ success: boolean; message: string }>('/plaid/remove.php', {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSyncAllConnections() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();

  return useMutation({
    mutationFn: async () => {
      const connectionsResult = await request<{ data: PlaidConnection[]; success: boolean }>(
        `/plaid/connections.php?plaid_environment=${plaidEnvironment}`
      );

      const connections = connectionsResult.data || [];
      if (connections.length === 0) {
        throw new Error('No bank connections found. Connect a bank first.');
      }

      let totalAdded = 0, totalModified = 0, totalRemoved = 0, totalAccounts = 0;

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

      return { added: totalAdded, modified: totalModified, removed: totalRemoved, accounts_updated: totalAccounts };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
