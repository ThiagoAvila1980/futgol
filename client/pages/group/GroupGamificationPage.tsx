import React from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { GamificationPanel } from '../../components/GamificationPanel';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupGamificationPage: React.FC = () => {
  const ctx = useGroupWorkspace();
  return (
    <ErrorBoundary>
      <GamificationPanel
        groupId={ctx.activeGroup.id}
        playerId={ctx.currentUser?.id}
        players={ctx.players}
        matches={ctx.matches}
        activeGroup={ctx.activeGroup}
      />
    </ErrorBoundary>
  );
};
