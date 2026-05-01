import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Field, Group, Match, Player, User } from '../types';
import { storage } from '../services/storage';
import { queryKeys } from '../query-keys';

export type GroupWorkspaceContextValue = {
  groupId: string;
  activeGroup: Group;
  currentUser: User;
  players: Player[];
  fields: Field[];
  matches: Match[];
  isDataLoading: boolean;
  refetchBundle: () => Promise<void>;
  handlePersistPlayer: (player: Player) => Promise<void>;
  handleDeletePlayer: (id: string) => Promise<void>;
  handlePersistField: (field: Field) => Promise<void>;
  handleDeleteField: (id: string) => Promise<void>;
  handlePersistMatch: (match: Match) => Promise<void>;
  handleDeleteMatch: (id: string) => Promise<void>;
};

const GroupWorkspaceContext = createContext<GroupWorkspaceContextValue | null>(null);

export function useGroupWorkspace(): GroupWorkspaceContextValue {
  const ctx = useContext(GroupWorkspaceContext);
  if (!ctx) {
    throw new Error('useGroupWorkspace deve ser usado dentro do grupo ativo.');
  }
  return ctx;
}

export function GroupWorkspaceProvider({
  groupId,
  activeGroup,
  currentUser,
  players,
  fields,
  matches,
  isDataLoading,
  refetchBundle,
  children,
}: {
  groupId: string;
  activeGroup: Group;
  currentUser: User;
  players: Player[];
  fields: Field[];
  matches: Match[];
  isDataLoading: boolean;
  refetchBundle: () => Promise<void>;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.groupBundle(groupId) });
    if (currentUser?.id) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groupsByUser(currentUser.id) });
    }
  }, [queryClient, groupId, currentUser?.id]);

  const handlePersistPlayer = useCallback(
    async (player: Player) => {
      const playerWithGroup = { ...player, groupId };
      await storage.players.save(playerWithGroup);
      await invalidate();
    },
    [groupId, invalidate],
  );

  const handleDeletePlayer = useCallback(
    async (id: string) => {
      const playerToRemove = players.find((p) => p.id === id);
      if (playerToRemove && activeGroup) {
        const targetId = playerToRemove.userId || playerToRemove.id;
        await storage.groups.removeMember(activeGroup.id, targetId);
      }
      await invalidate();
    },
    [players, activeGroup, invalidate],
  );

  const handlePersistField = useCallback(
    async (field: Field) => {
      const fieldWithGroup = { ...field, groupId };
      await storage.fields.save(fieldWithGroup);
      await invalidate();
    },
    [groupId, invalidate],
  );

  const handleDeleteField = useCallback(
    async (id: string) => {
      await storage.fields.delete(id);
      await invalidate();
    },
    [invalidate],
  );

  const handlePersistMatch = useCallback(
    async (match: Match) => {
      const matchWithGroup = { ...match, groupId };
      const saved = await storage.matches.save(matchWithGroup);
      queryClient.setQueryData(queryKeys.groupBundle(groupId), (prev) => {
        if (!prev) return prev;
        const matches = prev.matches.map((m) => (m.id === saved.id ? saved : m));
        return { ...prev, matches };
      });
    },
    [groupId, queryClient],
  );

  const handleDeleteMatch = useCallback(
    async (id: string) => {
      const cancelled = await storage.matches.cancel(id);
      queryClient.setQueryData(queryKeys.groupBundle(groupId), (prev) => {
        if (!prev) return prev;
        const matches = prev.matches.map((m) => (m.id === cancelled.id ? cancelled : m));
        return { ...prev, matches };
      });
    },
    [groupId, queryClient],
  );

  const value = useMemo(
    () => ({
      groupId,
      activeGroup,
      currentUser,
      players,
      fields,
      matches,
      isDataLoading,
      refetchBundle,
      handlePersistPlayer,
      handleDeletePlayer,
      handlePersistField,
      handleDeleteField,
      handlePersistMatch,
      handleDeleteMatch,
    }),
    [
      groupId,
      activeGroup,
      currentUser,
      players,
      fields,
      matches,
      isDataLoading,
      refetchBundle,
      handlePersistPlayer,
      handleDeletePlayer,
      handlePersistField,
      handleDeleteField,
      handlePersistMatch,
      handleDeleteMatch,
    ],
  );

  return <GroupWorkspaceContext.Provider value={value}>{children}</GroupWorkspaceContext.Provider>;
}
