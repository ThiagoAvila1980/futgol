import { useQuery } from '@tanstack/react-query';
import { storage } from '../services/storage';
import { queryKeys } from '../query-keys';

export function useGroupBundleQuery(groupId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: groupId && userId ? queryKeys.groupBundle(groupId) : ['groupBundle', 'idle'],
    enabled: !!groupId && !!userId,
    queryFn: async () => {
      const [players, fields, matches, userGroups] = await Promise.all([
        storage.players.getAll(groupId!),
        storage.fields.getAll(groupId!),
        storage.matches.getAll(groupId!),
        storage.groups.getByUser(userId!),
      ]);
      const group = userGroups.find((g) => g.id === groupId) ?? null;
      return { players, fields, matches, userGroups, group };
    },
  });
}
