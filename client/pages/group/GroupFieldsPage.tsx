import React from 'react';
import { FieldScreen } from '../../components/FieldScreen';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupFieldsPage: React.FC = () => {
  const ctx = useGroupWorkspace();
  return (
    <FieldScreen
      fields={ctx.fields}
      onSave={ctx.handlePersistField}
      onDelete={ctx.handleDeleteField}
      activeGroupId={ctx.activeGroup.id}
      currentUser={ctx.currentUser}
      activeGroup={ctx.activeGroup}
    />
  );
};
