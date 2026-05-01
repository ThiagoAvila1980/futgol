import React from 'react';
import { FinancialScreen } from '../../components/FinancialScreen';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupFinancialPage: React.FC = () => {
  const ctx = useGroupWorkspace();
  return <FinancialScreen activeGroup={ctx.activeGroup} players={ctx.players} />;
};
