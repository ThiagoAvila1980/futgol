import React from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { FullSessionSkeleton } from '../components/LoadingShells';
import { useQueryClient } from '@tanstack/react-query';
import { GroupsScreen } from '../components/GroupsScreen';
import { AuthenticatedChrome } from '../layout/AuthenticatedChrome';
import { authService } from '../services/auth';
import { queryKeys } from '../query-keys';
import type { User } from '../types';
import { useSessionQuery } from '../hooks/use-session-query';

export const GroupsRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useSessionQuery();

  if (isLoading) {
    return <FullSessionSkeleton />;
  }
  if (!user) {
    return <Navigate to="/" />;
  }

  const onUpdateUser = async (updatedUser: User) => {
    const savedUser = await authService.updateProfile(updatedUser);
    queryClient.setQueryData(queryKeys.me, savedUser);
    return savedUser;
  };

  return (
    <AuthenticatedChrome
      user={user}
      activeGroup={null}
      header={{ title: 'Meus Grupos', subtitle: 'Gerencie seus times' }}
    >
      <GroupsScreen
        user={user}
        onSelectGroup={(g) => navigate({ to: '/g/$groupId/dashboard', params: { groupId: g.id } })}
        activeGroupId={undefined}
        onUpdateUser={onUpdateUser}
      />
    </AuthenticatedChrome>
  );
};
