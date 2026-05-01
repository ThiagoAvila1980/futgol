export const queryKeys = {
  me: ['me'] as const,
  groupsByUser: (userId: string) => ['groups', 'byUser', userId] as const,
  groupBundle: (groupId: string) => ['groupBundle', groupId] as const,
};
