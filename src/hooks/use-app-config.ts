import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appConfigApi, AppConfig } from '@/lib/api';

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => (await appConfigApi.get()).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<AppConfig>) => (await appConfigApi.save(config)).data,
    onSuccess: (data) => {
      qc.setQueryData(['app-config'], data);
    },
  });
}
