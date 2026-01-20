
import { Player, Field, Match, User, Group, Position, Transaction, Comment } from '../types';
import api from './api';

/**
 * SERVIÇO DE ARMAZENAMENTO (CAMADA DE DADOS)
 * 
 * Agora suporta multi-tenancy (grupos). Os métodos getAll filtram por groupId.
 */

const KEYS = {
  PLAYERS: 'futgol_players',
  FIELDS: 'futgol_fields',
  MATCHES: 'futgol_matches',
  GROUPS: 'futgol_groups',
  USERS: 'futgol_users_global',
  TRANSACTIONS: 'futgol_transactions'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- DATA SEEDING (DADOS FICTÍCIOS) ---
export const seedDatabase = async () => {
  try {
    const existing: Group[] = await api.get(`/api/groups/`);
    let targetGroupId = '';
    let targetAdminId = 'user_123';
    if (!Array.isArray(existing) || existing.length === 0) {
      const groupId = 'group_demo_01';
      const group: Group = {
        id: groupId,
        adminId: targetAdminId,
        admins: [targetAdminId],
        name: 'Pelada dos Amigos ⚽',
        sport: 'Futebol Society',
        inviteCode: 'GOL-10',
        createdAt: new Date().toISOString(),
        members: [targetAdminId],
        pendingRequests: [],
        paymentMode: 'fixed',
        fixedAmount: 0,
        monthlyFee: 100,
        city: 'São Paulo, SP'
      };
      await api.put(`/api/groups/${group.id}/`, group);
      targetGroupId = groupId;
    } else {
      targetGroupId = existing[0].id;
      targetAdminId = existing[0].adminId;
    }

    const currentFields: Field[] = await api.get(`/api/fields/?groupId=${encodeURIComponent(targetGroupId)}`);
    const needFields = Math.max(0, 10 - currentFields.length);
    if (needFields > 0) {
      const baseNames = [
        'Arena Champions', 'Quadra do Bairro', 'Estádio Municipal', 'Arena Pro',
        'Campo Central', 'Estádio da Amizade', 'Quadra Esportiva', 'Arena Elite',
        'Campo das Flores', 'Estação Futebol'
      ];
      for (let i = 0; i < needFields; i++) {
        const name = baseNames[i % baseNames.length] + ` ${i + 1}`;
        const f: Field = {
          id: `seed_field_${Date.now()}_${i}`,
          groupId: targetGroupId,
          name,
          location: `Endereço ${i + 1}, Cidade`,
          contactName: 'Contato',
          contactPhone: '(11) 9' + String(10000000 + Math.floor(Math.random() * 89999999)),
          hourlyRate: 100 + Math.floor(Math.random() * 200),
          coordinates: { lat: -23.55 + Math.random() * 0.1, lng: -46.63 + Math.random() * 0.1 }
        };
        await api.put(`/api/fields/${f.id}/`, f);
      }
    }

    const currentPlayers: Player[] = await api.get(`/api/players/?groupId=${encodeURIComponent(targetGroupId)}`);
    const needPlayers = Math.max(0, 40 - currentPlayers.length);
    if (needPlayers > 0) {
      const firstNames = ['João', 'Carlos', 'Pedro', 'Lucas', 'Mateus', 'Gustavo', 'Rafael', 'Bruno', 'Felipe', 'Thiago', 'Diego', 'André', 'Gabriel', 'Henrique', 'Eduardo', 'Murilo', 'Vitor', 'Leandro', 'Paulo', 'Caio'];
      const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Ferreira', 'Almeida', 'Barbosa', 'Rocha', 'Lima', 'Araújo', 'Costa', 'Ribeiro', 'Carvalho', 'Gomes', 'Moura', 'Batista', 'Lopes', 'Vieira', 'Teixeira'];
      const positions: Position[] = [Position.ATACANTE, Position.MEIO, Position.DEFENSOR, Position.GOLEIRO];
      for (let i = 0; i < needPlayers; i++) {
        const fname = firstNames[i % firstNames.length];
        const lname = lastNames[(i * 3) % lastNames.length];
        const full = `${fname} ${lname}`;
        const pos = positions[i % positions.length];
        const email = `${fname.toLowerCase()}.${lname.toLowerCase()}${i}@exemplo.com`;
        const p: Player = {
          id: `seed_player_${Date.now()}_${i}`,
          groupId: targetGroupId,
          name: full,
          nickname: fname,
          birthDate: '1990-01-01',
          email,
          favoriteTeam: ['Brasil', 'São Paulo', 'Corinthians', 'Palmeiras', 'Flamengo'][i % 5],
          position: pos,
          rating: 3 + Math.round(Math.random() * 2),
          matchesPlayed: Math.floor(Math.random() * 30),
          avatar: undefined,
          isMonthlySubscriber: i % 5 === 0
        };
        await api.put(`/api/players/${p.id}/`, p);
      }
    }
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('HTTP 401')) {
      return;
    }
    console.error(e);
  }
};


export const storage = {
  seedDatabase, // Exportar para usar no App.tsx

  // Operações de Usuário
  users: {
    // Busca um usuário pelo ID (checa sessão local, mock e banco global)
    findById: async (id: string): Promise<User | null> => {
      // Mock Users
      if (id === 'user_123') return { id: 'user_123', name: 'Admin Teste', email: 'thiago@teste.com' };
      if (id === '123') return { id: '123', name: 'Neymar Júnior', email: 'njr@brasil.com', avatar: 'https://ui-avatars.com/api/?name=Neymar+Jr&background=random' };
      if (id === 'cr7') return { id: 'cr7', name: 'Cristiano Ronaldo', email: 'cr7@portugal.com', avatar: 'https://ui-avatars.com/api/?name=Cristiano+Ronaldo&background=random' };

      // Local Session
      const session = localStorage.getItem('futgol_user_session');
      if (session) {
        const self = JSON.parse(session);
        if (self.id === id) return self;
      }

      // Try Real Backend
      try {
        const user = await api.get(`/api/accounts/lookup_by_id/?id=${encodeURIComponent(id)}`);
        if (user) return user as User;
      } catch (e) {
        // Not found in backend, fall through
      }

      // Fallback: If simulation mode or strictly needed
      // return {
      //   id,
      //   name: `Usuário ${id.substring(0, 5)}`,
      //   email: 'usuario@exemplo.com',
      //   avatar: `https://ui-avatars.com/api/?name=User+${id}&background=random`
      // };
      return null;
    }
  },

  // Operações de Grupo (Multi-tenancy)
  groups: {
    // Retorna todos os grupos onde o usuário é membro ou dono
    getByUser: async (userId: string): Promise<Group[]> => {
      const data = await api.get(`/api/groups/by_user/?userId=${encodeURIComponent(userId)}`);
      return data as Group[];
    },
    // Retorna todos os grupos públicos do sistema
    getAll: async (): Promise<Group[]> => {
      const data = await api.get(`/api/groups/`);
      return data as Group[];
    },
    save: async (group: Group): Promise<Group> => {
      if (!group.admins) group.admins = [group.adminId];
      if (!group.members) group.members = [group.adminId];
      if (!group.pendingRequests) group.pendingRequests = [];
      const res = await api.put(`/api/groups/${encodeURIComponent(group.id)}/`, group);
      return res as Group;
    },
    requestJoin: async (groupId: string, userId: string, message?: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/request_join/`, { userId, message });
    },
    cancelRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/cancel_request/`, { userId });
    },
    approveRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/approve_request/`, { userId });
    },
    rejectRequest: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/reject_request/`, { userId });
    },
    removeMember: async (groupId: string, userId: string): Promise<void> => {
      await api.delete(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`);
    },
    promoteMember: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/promote_member/`, { userId });
    },
    demoteMember: async (groupId: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/${encodeURIComponent(groupId)}/demote_member/`, { userId });
    },
    generateInvite: async (groupId: string, ttlSeconds?: number): Promise<{ token: string; ttl: number }> => {
      const data = await api.post(`/api/groups/${encodeURIComponent(groupId)}/generate_invite/`, { ttl: ttlSeconds });
      return data as { token: string; ttl: number };
    },
    joinWithInvite: async (token: string, userId: string): Promise<void> => {
      await api.post(`/api/groups/join_with_invite/`, { token, userId });
    },
    getRequests: async (groupId: string): Promise<any[]> => {
      return await api.get(`/api/groups/${encodeURIComponent(groupId)}/requests/`);
    }
  },

  players: {
    getAll: async (groupId: string): Promise<Player[]> => {
      const data = await api.get(`/api/players/?groupId=${encodeURIComponent(groupId)}`);
      return data as Player[];
    },
    save: async (player: Player): Promise<Player> => {
      const res = await api.put(`/api/players/${encodeURIComponent(player.id)}/`, player);
      return res as Player;
    },

    updateByUserId: async (userId: string, userData: Partial<User>): Promise<void> => {
      await api.post(`/api/players/update_by_user/`, { userId, userData });
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/players/${encodeURIComponent(id)}/`);
    }
  },

  fields: {
    getAll: async (groupId: string): Promise<Field[]> => {
      const data = await api.get(`/api/fields/?groupId=${encodeURIComponent(groupId)}`);
      return data as Field[];
    },
    save: async (field: Field): Promise<Field> => {
      const res = await api.put(`/api/fields/${encodeURIComponent(field.id)}/`, field);
      return res as Field;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/fields/${encodeURIComponent(id)}/`);
    }
  },

  matches: {
    getAll: async (groupId: string): Promise<Match[]> => {
      const data = await api.get(`/api/matches/?groupId=${encodeURIComponent(groupId)}`);
      return data as Match[];
    },
    save: async (match: Match): Promise<Match> => {
      const res = await api.put(`/api/matches/${encodeURIComponent(match.id)}/`, match);
      return res as Match;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/matches/${encodeURIComponent(id)}/`);
    },
    reopen: async (id: string): Promise<Match> => {
      const data = await api.post(`/api/matches/${encodeURIComponent(id)}/reopen/`, {});
      return data as Match;
    }
  },

  transactions: {
    getAll: async (groupId: string): Promise<Transaction[]> => {
      const data = await api.get(`/api/transactions/?groupId=${encodeURIComponent(groupId)}`);
      return data as Transaction[];
    },
    save: async (transaction: Transaction): Promise<Transaction> => {
      const res = await api.put(`/api/transactions/${encodeURIComponent(transaction.id)}/`, transaction);
      return res as Transaction;
    },
    upsertMatchTransaction: async (groupId: string, matchId: string, totalAmount: number, description: string, date: string): Promise<void> => {
      await api.post(`/api/transactions/upsert_match/`, { groupId, matchId, totalAmount, description, date });
    },
    upsertMonthlyTransaction: async (groupId: string, playerId: string, amount: number, date: string): Promise<void> => {
      await api.post(`/api/transactions/upsert_monthly/`, { groupId, playerId, amount, date });
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/transactions/${encodeURIComponent(id)}/`);
    }
  },
  comments: {
    getAll: async (groupId: string, matchId: string): Promise<Comment[]> => {
      const data = await api.get(`/api/comments/?groupId=${encodeURIComponent(groupId)}&matchId=${encodeURIComponent(matchId)}`);
      return data as Comment[];
    },
    save: async (comment: Comment): Promise<Comment> => {
      const res = await api.put(`/api/comments/${encodeURIComponent(comment.id)}/`, comment);
      return res as Comment;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/comments/${encodeURIComponent(id)}/`);
    }
  }
};
