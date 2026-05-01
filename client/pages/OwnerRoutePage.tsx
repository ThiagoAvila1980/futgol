import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { FullSessionSkeleton } from '../components/LoadingShells';
import { OwnerDashboard } from '../components/OwnerDashboard';
import { AuthenticatedChrome } from '../layout/AuthenticatedChrome';
import { useSessionQuery } from '../hooks/use-session-query';

export const OwnerRoutePage: React.FC = () => {
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
      header={{ title: 'Painel do Dono', subtitle: 'Gerencie suas quadras e agendamentos' }}
    >
      <OwnerDashboard user={user} />
    </AuthenticatedChrome>
  );
};
