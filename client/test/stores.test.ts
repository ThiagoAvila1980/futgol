import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../stores/useAppStore';

vi.mock('../services/storage', () => ({
  storage: {
    players: { getAll: vi.fn().mockResolvedValue([]) },
    fields: { getAll: vi.fn().mockResolvedValue([]) },
    matches: { getAll: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../services/auth', () => ({
  authService: {
    validateSession: vi.fn().mockResolvedValue(null),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentUser: null,
      activeGroup: null,
      players: [],
      fields: [],
      matches: [],
      notifications: [],
    });
  });

  it('should initialize with null user', () => {
    const state = useAppStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.activeGroup).toBeNull();
    expect(state.players).toHaveLength(0);
  });

  it('should set current user', () => {
    useAppStore.getState().setCurrentUser({
      id: 'user1',
      name: 'Test User',
      email: 'test@test.com',
    });
    expect(useAppStore.getState().currentUser?.id).toBe('user1');
  });

  it('should set active group', () => {
    useAppStore.getState().setActiveGroup({
      id: 'group1',
      adminId: 'user1',
      name: 'Test Group',
      sport: 'Futebol',
      inviteCode: 'ABC',
      createdAt: new Date().toISOString(),
      members: ['user1'],
      pendingRequests: [],
    });
    expect(useAppStore.getState().activeGroup?.name).toBe('Test Group');
  });

  it('should add notifications', () => {
    useAppStore.getState().addNotification('New match!');
    useAppStore.getState().addNotification('Player joined!');
    expect(useAppStore.getState().notifications).toHaveLength(2);
    expect(useAppStore.getState().notifications[0]).toBe('Player joined!');
  });

  it('should clear all state on logout', async () => {
    useAppStore.getState().setCurrentUser({ id: 'u1', name: 'Test', email: 't@t.com' });
    useAppStore.getState().setPlayers([{ id: 'p1' } as any]);
    await useAppStore.getState().logout();

    const state = useAppStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.activeGroup).toBeNull();
    expect(state.players).toHaveLength(0);
  });
});
