import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LandingScreen } from '../components/LandingScreen';
import { FullSessionSkeleton } from '../components/LoadingShells';
import { queryClient } from '../query-client';
import { queryKeys } from '../query-keys';
import type { User } from '../types';
import { useSessionQuery } from '../hooks/use-session-query';

export const LandingRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const { data: user, isLoading } = useSessionQuery();

  useEffect(() => {
    if (!isLoading && user) {
      navigate({ to: '/groups' });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return <FullSessionSkeleton />;
  }
  if (user) {
    return null;
  }

  const onLoginSuccess = (u: User) => {
    queryClient.setQueryData(queryKeys.me, u);
    navigate({ to: '/groups' });
  };

  return <LandingScreen onLoginSuccess={onLoginSuccess} />;
};
