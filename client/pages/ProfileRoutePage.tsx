import React from 'react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { FullSessionSkeleton } from '../components/LoadingShells';
import { useQueryClient } from '@tanstack/react-query';
import { ProfileScreen } from '../components/ProfileScreen';
import { AuthenticatedChrome } from '../layout/AuthenticatedChrome';
import { authService } from '../services/auth';
import { queryKeys } from '../query-keys';
import type { User } from '../types';
import { useSessionQuery } from '../hooks/use-session-query';

export const ProfileRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useSessionQuery();

  if (isLoading) {
    return <FullSessionSkeleton />;
  }
  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <AuthenticatedChrome
      user={user}
      activeGroup={null}
      header={{ title: 'Minha Conta', subtitle: 'Atualize seus dados pessoais' }}
    >
      <ProfileScreen
        user={user}
        onSave={async (updatedUser: User) => {
          const savedUser = await authService.updateProfile(updatedUser);
          queryClient.setQueryData(queryKeys.me, savedUser);
          navigate({ to: '/groups' });
        }}
        onCancel={() => navigate({ to: '/groups' })}
      />
    </AuthenticatedChrome>
  );
};
