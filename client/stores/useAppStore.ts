import { create } from 'zustand';
import { Player, Field, Match, User, Group, Transaction } from '../types';
import { storage } from '../services/storage';
import { authService } from '../services/auth';

interface AppState {
  currentUser: User | null;
  activeGroup: Group | null;
  players: Player[];
  fields: Field[];
  matches: Match[];
  transactions: Transaction[];
  isLoading: boolean;
  notifications: string[];

  setCurrentUser: (user: User | null) => void;
  setActiveGroup: (group: Group | null) => void;
  setPlayers: (players: Player[]) => void;
  setFields: (fields: Field[]) => void;
  setMatches: (matches: Match[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addNotification: (msg: string) => void;
  clearNotifications: () => void;

  fetchGroupData: (silent?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  validateSession: () => Promise<User | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  activeGroup: null,
  players: [],
  fields: [],
  matches: [],
  transactions: [],
  isLoading: false,
  notifications: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveGroup: (group) => set({ activeGroup: group }),
  setPlayers: (players) => set({ players }),
  setFields: (fields) => set({ fields }),
  setMatches: (matches) => set({ matches }),
  setTransactions: (transactions) => set({ transactions }),
  addNotification: (msg) => set((s) => ({ notifications: [msg, ...s.notifications].slice(0, 5) })),
  clearNotifications: () => set({ notifications: [] }),

  fetchGroupData: async (silent = false) => {
    const { activeGroup, currentUser } = get();
    if (!activeGroup || !currentUser) return;

    if (!silent) set({ isLoading: true });
    try {
      const [players, fields, matches] = await Promise.all([
        storage.players.getAll(activeGroup.id),
        storage.fields.getAll(activeGroup.id),
        storage.matches.getAll(activeGroup.id),
      ]);
      set({ players, fields, matches });
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await authService.logout();
    set({
      currentUser: null,
      activeGroup: null,
      players: [],
      fields: [],
      matches: [],
      transactions: [],
      notifications: [],
    });
  },

  validateSession: async () => {
    try {
      const user = await authService.validateSession();
      set({ currentUser: user });
      return user;
    } catch {
      return null;
    }
  },
}));
