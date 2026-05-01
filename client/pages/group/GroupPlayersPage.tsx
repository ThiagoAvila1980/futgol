import React from 'react';
import { PlayerScreen } from '../../components/PlayerScreen';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupPlayersPage: React.FC = () => {
  const ctx = useGroupWorkspace();
  return (
    <PlayerScreen
      players={ctx.players}
      matches={ctx.matches}
      onSave={ctx.handlePersistPlayer}
      onDelete={ctx.handleDeletePlayer}
      activeGroup={ctx.activeGroup}
      currentUser={ctx.currentUser}
      onRefresh={() => void ctx.refetchBundle()}
    />
  );
};
