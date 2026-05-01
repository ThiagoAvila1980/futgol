import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { FullSessionSkeleton, LazyRouteSkeleton } from '../../components/LoadingShells';
import { GroupWorkspaceProvider } from '../../context/GroupWorkspaceContext';
import { AuthenticatedChrome } from '../../layout/AuthenticatedChrome';
import { useGroupBundleQuery } from '../../hooks/use-group-bundle-query';
import { useSessionQuery } from '../../hooks/use-session-query';

export function GroupLayout() {
  const { groupId } = useParams({ from: '/g/$groupId' });
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: user, isLoading: authLoading } = useSessionQuery();
  const { data: bundle, isLoading: bundleLoading, refetch, isFetching } = useGroupBundleQuery(groupId, user?.id);

  const prevConfirmCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/' });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!bundle || !groupId || authLoading) return;
    if (!bundle.group) navigate({ to: '/groups' });
  }, [bundle, groupId, authLoading, navigate]);

  useEffect(() => {
    if (!bundle?.matches?.length || !bundle.fields || !bundle.group) return;
    const sport = bundle.group.sport;
    const cap = sport === 'Futebol de Campo' ? 22 : 14;
    const prev = prevConfirmCountsRef.current;
    bundle.matches.forEach((m) => {
      const count = (m.confirmedPlayerIds || []).length;
      const prevCount = prev[m.id] ?? count;
      if (prevCount >= cap && count < cap) {
        const field = bundle.fields.find((f) => f.id === m.fieldId);
        const label = `${m.date} ${m.time || ''}${field ? ` - ${field.name}` : ''}`.trim();
        toast.message(`Vaga aberta no jogo ${label}`);
      }
      prev[m.id] = count;
    });
  }, [bundle?.matches, bundle?.fields, bundle?.group]);

  const header = useMemo(() => {
    if (!user || !bundle?.group) {
      return { title: '', subtitle: '' };
    }
    const segment =
      pathname.replace(`/g/${groupId}/`, '').replace(/\/$/, '') || 'dashboard';
    const map: Record<string, { title: string; subtitle: string }> = {
      dashboard: {
        title: 'Início',
        subtitle: `E ae ${user.name.split(' ')[0]}! Tudo pronto para o jogo?`,
      },
      players: { title: 'Jogadores', subtitle: 'Gestão profissional do grupo.' },
      matches: { title: 'Jogos', subtitle: 'Organize peladas e confirme presenças.' },
      fields: { title: 'Locais', subtitle: 'Gestão profissional do grupo.' },
      financial: { title: 'Financeiro', subtitle: 'Controle financeiro transparente' },
      gamification: { title: 'Ranking & Conquistas', subtitle: 'Acompanhe seu progresso e conquistas' },
    };
    return map[segment] || map.dashboard;
  }, [user, bundle?.group, pathname, groupId]);

  if (authLoading || (user && groupId && bundleLoading && !bundle)) {
    return <FullSessionSkeleton />;
  }
  if (!user) return null;
  if (!bundle?.group) {
    return <FullSessionSkeleton />;
  }

  return (
    <GroupWorkspaceProvider
      groupId={groupId}
      activeGroup={bundle.group}
      currentUser={user}
      players={bundle.players}
      fields={bundle.fields}
      matches={bundle.matches}
      isDataLoading={bundleLoading || isFetching}
      refetchBundle={async () => {
        await refetch();
      }}
    >
      <AuthenticatedChrome
        user={user}
        groupId={groupId}
        activeGroup={bundle.group}
        header={header}
        isDataLoading={bundleLoading || isFetching}
      >
        <ErrorBoundary>
          <Suspense fallback={<LazyRouteSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </AuthenticatedChrome>
    </GroupWorkspaceProvider>
  );
}
