import React from 'react';
import { MatchScreen } from '../../components/MatchScreen';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupMatchesPage: React.FC = () => {
  const ctx = useGroupWorkspace();
  return (
    <MatchScreen
      players={ctx.players}
      fields={ctx.fields}
      matches={ctx.matches}
      onSave={ctx.handlePersistMatch}
      onDelete={ctx.handleDeleteMatch}
      activeGroupId={ctx.activeGroup.id}
      currentUser={ctx.currentUser}
      activeGroup={ctx.activeGroup}
      onRefresh={() => void ctx.refetchBundle()}
      isLoading={ctx.isDataLoading}
    />
  );
};
