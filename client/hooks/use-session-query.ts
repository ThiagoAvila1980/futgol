import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/auth';
import { queryKeys } from '../query-keys';

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authService.validateSession(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
