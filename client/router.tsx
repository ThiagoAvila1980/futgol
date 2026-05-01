import React, { useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { queryClient } from './query-client';
import { useSessionQuery } from './hooks/use-session-query';
import { pushService } from './services/push';
import { LandingRoutePage } from './pages/LandingRoutePage';
import { GroupsRoutePage } from './pages/GroupsRoutePage';
import { ProfileRoutePage } from './pages/ProfileRoutePage';
import { OwnerRoutePage } from './pages/OwnerRoutePage';
import { GroupLayout } from './pages/group/GroupLayout';

const GroupDashboardPage = React.lazy(() =>
  import('./pages/group/GroupDashboardPage').then((m) => ({ default: m.GroupDashboardPage })),
);
const GroupPlayersPage = React.lazy(() =>
  import('./pages/group/GroupPlayersPage').then((m) => ({ default: m.GroupPlayersPage })),
);
const GroupFieldsPage = React.lazy(() =>
  import('./pages/group/GroupFieldsPage').then((m) => ({ default: m.GroupFieldsPage })),
);
const GroupMatchesPage = React.lazy(() =>
  import('./pages/group/GroupMatchesPage').then((m) => ({ default: m.GroupMatchesPage })),
);
const GroupFinancialPage = React.lazy(() =>
  import('./pages/group/GroupFinancialPage').then((m) => ({ default: m.GroupFinancialPage })),
);
const GroupGamificationPage = React.lazy(() =>
  import('./pages/group/GroupGamificationPage').then((m) => ({ default: m.GroupGamificationPage })),
);

function RootLayout() {
  const { data: user } = useSessionQuery();
  useEffect(() => {
    if (user && pushService.isSupported()) {
      pushService.subscribe(user.id).catch(() => {});
    }
  }, [user]);
  return (
    <>
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingRoutePage,
});

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  component: GroupsRoutePage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfileRoutePage,
});

const ownerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/owner',
  component: OwnerRoutePage,
});

const groupLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'g/$groupId',
  component: GroupLayout,
});

const groupIndexRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/g/$groupId/dashboard',
      params: { groupId: params.groupId },
    });
  },
});

const groupDashboardRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'dashboard',
  component: GroupDashboardPage,
});

const groupMatchesRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'matches',
  component: GroupMatchesPage,
});

const groupPlayersRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'players',
  component: GroupPlayersPage,
});

const groupFieldsRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'fields',
  component: GroupFieldsPage,
});

const groupFinancialRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'financial',
  component: GroupFinancialPage,
});

const groupGamificationRoute = createRoute({
  getParentRoute: () => groupLayoutRoute,
  path: 'gamification',
  component: GroupGamificationPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  groupsRoute,
  profileRoute,
  ownerRoute,
  groupLayoutRoute.addChildren([
    groupIndexRoute,
    groupDashboardRoute,
    groupMatchesRoute,
    groupPlayersRoute,
    groupFieldsRoute,
    groupFinancialRoute,
    groupGamificationRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
