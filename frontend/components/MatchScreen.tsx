
import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';
import { Player, Field, Match, User, Group, Position, Comment, SubMatch } from '../types';
// import { balanceTeamsWithAI } from '../services/geminiService';
import { storage } from '../services/storage';
import { MatchVoteCard } from './MatchVoteCard';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface MatchScreenProps {
  players: Player[];
  fields: Field[];
  matches: Match[];
  onSave: (match: Match) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroupId: string;
  currentUser: User;
  activeGroup: Group;
  onRefresh?: () => Promise<any>;
  isLoading?: boolean;
}

export const MatchScreen: React.FC<MatchScreenProps> = ({ players, fields, matches, onSave, onDelete, activeGroupId, currentUser, activeGroup, onRefresh, isLoading }) => {
  // Estados de Controle de Visualização
  const [view, setView] = useState<'list' | 'details' | 'queue'>('list');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Estados de Filtro (Lista de Presença e Pagamentos)
  const [playerFilter, setPlayerFilter] = useState<'all' | 'confirmed' | 'paid' | 'unpaid' | 'monthly'>('all');
  const [finishedPaymentsFilter, setFinishedPaymentsFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Controle de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado do Formulário (Agendamento)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [fieldId, setFieldId] = useState('');

  // Estados de Finalização de Jogo (Placar, MVP)
  const [scoreA, setScoreA] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [scoreB, setScoreB] = useState(0);
  const [mvpId, setMvpId] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Estados de proteção contra cliques duplos (pagamento e presença)
  const [updatingPaymentFor, setUpdatingPaymentFor] = useState<string | null>(null);
  const [updatingPresenceFor, setUpdatingPresenceFor] = useState<string | null>(null);
  const [updatingArrivalFor, setUpdatingArrivalFor] = useState<string | null>(null);

  // Gerenciamento de Convidados
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>(Position.MEIO);
  const [hideGuests, setHideGuests] = useState(false);

  // Equilíbrio de Times com Inteligência Artificial
  const [isBalancing, setIsBalancing] = useState(false);
  const [outfieldPlayers, setOutfieldPlayers] = useState(5);
  const [subMatches, setSubMatches] = useState<SubMatch[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [draggingPlayer, setDraggingPlayer] = useState<{ playerId: string, subMatchId: string, fromTeam: 'A' | 'B' } | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<{ subMatchId: string, team: 'A' | 'B' } | null>(null);
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number, y: number } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [activeSubMatchMenuId, setActiveSubMatchMenuId] = useState<string | null>(null);
  const [activePlayerMenu, setActivePlayerMenu] = useState<{ subMatchId: string, playerId: string } | null>(null);

  // Confirmação de Exclusão e Busca de Convidados
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestCandidates, setGuestCandidates] = useState<Player[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);

  // Gestão Financeira de Mensalistas
  const [monthlyTxMap, setMonthlyTxMap] = useState<Record<string, string>>({});
  const [monthlyAggregateId, setMonthlyAggregateId] = useState<string | null>(null);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);

  // Sistema de Comentários e Respostas
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyOpenMap, setReplyOpenMap] = useState<Record<string, boolean>>({});
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);


  // Filtro de Mês na Listagem de Jogos
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Verificação de permissão administrativa
  const isAdmin = activeGroup.adminId === currentUser.id || (activeGroup.admins?.includes(currentUser.id) || false);

  // Localiza o perfil de jogador vinculado ao usuário logado
  const currentPlayer = players.find(p => p.userId === currentUser.id);

  const getDisplayName = (p: Player) => p.nickname || p.name;

  const currentMonth = () => new Date().toISOString().split('T')[0].slice(0, 7);
  // Sincroniza o status de pagamento mensal dos jogadores do grupo
  const loadMonthlyStatus = async () => {
    try {
      if (!selectedMatch) return;
      setIsMonthlyLoading(true);
      const txs = await storage.transactions.getAll(activeGroupId);

      // Usa o mês da partida selecionada como referência para o status de mensalidade
      const m = selectedMatch.date.slice(0, 7);
      const map: Record<string, string> = {};

      // Mapeia quem já pagou a mensalidade no mês da partida
      txs.forEach(t => {
        if (t.category === 'MONTHLY_FEE' && (t.date || '').slice(0, 7) === m) {
          // Caso seja transação individual
          if (t.relatedPlayerId) {
            map[t.relatedPlayerId] = t.id;
          }
          // Caso seja transação agregada com lista de IDs
          if (t.paidPlayerIds && Array.isArray(t.paidPlayerIds)) {
            t.paidPlayerIds.forEach(pid => {
              map[pid] = t.id;
            });
          }
        }
      });
      setMonthlyTxMap(map);

      // Busca a transação agregada que representa a soma das mensalidades no fluxo de caixa
      const aggregate = txs.find(t => t.category === 'MONTHLY_FEE' && !t.relatedPlayerId && (t.date || '').slice(0, 7) === m && (t.description || '').toLowerCase().includes('mensalistas'));
      setMonthlyAggregateId(aggregate ? aggregate.id : null);
    } catch {
      setMonthlyTxMap({});
      setMonthlyAggregateId(null);
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const genSafeId = (prefix: string = 'id') => {
    const c: any = (window as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${prefix}_` + Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const firstDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const syncMonthlyAggregate = async (paidCount: number) => {
    const amt = (Number(activeGroup.fixedAmount || 0)) * paidCount;
    const tx = {
      id: monthlyAggregateId || genSafeId('aggregate'),
      groupId: activeGroupId,
      description: 'Mensalistas',
      amount: amt,
      type: 'INCOME' as const,
      category: 'MONTHLY_FEE' as const,
      date: firstDayOfCurrentMonth(),
    };
    await storage.transactions.save(tx as any);
    if (!monthlyAggregateId) setMonthlyAggregateId(tx.id);
  };

  useEffect(() => {
    if (view === 'details' && selectedMatch) {
      loadMonthlyStatus();
      loadComments();
    }
  }, [view, selectedMatch, activeGroupId]);

  useEffect(() => {
    if (selectedMatch) {
      setSubMatches(selectedMatch.subMatches || []);
    } else {
      setSubMatches([]);
    }
  }, [selectedMatch]);



  const loadComments = async () => {
    try {
      if (!selectedMatch) return;
      setIsCommentsLoading(true);
      const data = await storage.comments.getAll(activeGroupId, selectedMatch.id);
      data.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const submitNewComment = async () => {
    if (!selectedMatch || !newCommentText.trim() || isSaving) return;
    const c: Comment = {
      id: genSafeId('comment'),
      groupId: activeGroupId,
      matchId: selectedMatch.id,
      parentId: undefined,
      authorPlayerId: currentPlayer ? currentPlayer.id : currentUser.id,
      content: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      setIsSaving(true);
      await storage.comments.save(c);
      setNewCommentText('');
      await loadComments();
    } catch {
      alert('Não foi possível enviar o comentário.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!selectedMatch) return;
    const text = (replyTextMap[parentId] || '').trim();
    if (!text || isSaving) return;
    const c: Comment = {
      id: genSafeId('reply'),
      groupId: activeGroupId,
      matchId: selectedMatch.id,
      parentId,
      authorPlayerId: currentPlayer ? currentPlayer.id : currentUser.id,
      content: text,
      createdAt: new Date().toISOString(),
    };
    try {
      setIsSaving(true);
      await storage.comments.save(c);
      setReplyTextMap(prev => ({ ...prev, [parentId]: '' }));
      setReplyOpenMap(prev => ({ ...prev, [parentId]: false }));
      await loadComments();
    } catch {
      alert('Não foi possível enviar a resposta.');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteComment = (id: string) => {
    setDeleteCommentId(id);
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentId || isSaving) return;
    try {
      setIsSaving(true);
      await storage.comments.delete(deleteCommentId);
      setDeleteCommentId(null);
      await loadComments();
    } catch {
      alert('Não foi possível excluir o comentário.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelDeleteComment = () => {
    setDeleteCommentId(null);
  };


  const isMonthlyPaid = (playerId: string) => !!monthlyTxMap[playerId];
  const toggleMonthlyFee = async (player: Player) => {
    if (!isAdmin || !player.isMonthlySubscriber || isSaving) return;
    const existingId = monthlyTxMap[player.id];
    try {
      setIsSaving(true);
      if (existingId) {
        await storage.transactions.delete(existingId);
      } else {
        const txId = genSafeId('monthly');
        const amt = Number(activeGroup.fixedAmount || 0);
        const tx = {
          id: txId,
          groupId: activeGroupId,
          description: `Mensalidade - ${getDisplayName(player)}`,
          amount: amt,
          type: 'INCOME' as const,
          category: 'MONTHLY_FEE' as const,
          relatedPlayerId: player.id,
          date: new Date().toISOString().split('T')[0],
        };
        await storage.transactions.save(tx);
      }
      // Update local map optimistically
      const newMap = { ...monthlyTxMap };
      if (existingId) {
        delete newMap[player.id];
      } else {
        newMap[player.id] = 'new';
      }
      setMonthlyTxMap(newMap);
      await syncMonthlyAggregate(Object.keys(newMap).length);
      await loadMonthlyStatus();
    } catch {
      alert('Não foi possível atualizar a mensalidade.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOrUpdateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || isSaving) return;

    try {
      if (!date || !time || !fieldId) {
        alert('Por favor, preencha todos os campos (Data, Horário e Local).');
        return;
      }

      setIsSaving(true);
      let matchToSave: Match;

      if (editingMatchId) {
        const existing = matches.find(m => m.id === editingMatchId);
        if (!existing) {
          alert('Erro: Jogo não encontrado para edição.');
          return;
        }
        matchToSave = {
          ...existing,
          date,
          time,
          fieldId
        };
      } else {
        const id = genSafeId('match');

        matchToSave = {
          id,
          groupId: activeGroupId,
          date,
          time,
          fieldId,
          confirmedPlayerIds: [],
          teamA: [],
          teamB: [],
          scoreA: 0,
          scoreB: 0,
          finished: false,
        };
      }

      await onSave(matchToSave);
      closeModal();
    } catch (err) {
      console.error("Erro ao agendar jogo:", err);
      alert('Falha ao agendar jogo. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewMatchModal = () => {
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const defaultTime = `${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`;
    setDate(isoDate);
    setTime(defaultTime);
    setFieldId(fields[0]?.id || '');
    setEditingMatchId(null);
    setIsModalOpen(true);
  }

  const handleEditMatch = (match: Match) => {
    if (!isAdmin) return;
    setDate(match.date);
    setTime(match.time);
    setFieldId(match.fieldId);
    setEditingMatchId(match.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (!matchToDelete || isSaving) return;
    try {
      setIsSaving(true);
      await onDelete(matchToDelete);
      if (selectedMatch?.id === matchToDelete) {
        setSelectedMatch(null);
        setView('list');
      }
      setMatchToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir partida.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setDate('');
    setTime('');
    setFieldId('');
    setEditingMatchId(null);
  };

  const togglePresence = async (matchId: string, playerId: string) => {
    const canToggle = isAdmin || (currentPlayer && currentPlayer.id === playerId);
    if (!canToggle || isSaving) return; // Added isSaving check
    if (updatingPresenceFor === playerId) return; // Proteção contra duplo clique

    try {
      setIsSaving(true); // Set isSaving
      setUpdatingPresenceFor(playerId);
      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      const isConfirmed = match.confirmedPlayerIds.includes(playerId);

      let newTeamA = match.teamA;
      let newTeamB = match.teamB;

      if (isConfirmed) {
        newTeamA = match.teamA.filter(p => p.id !== playerId);
        newTeamB = match.teamB.filter(p => p.id !== playerId);
      }

      const updatedMatch = {
        ...match,
        confirmedPlayerIds: isConfirmed
          ? match.confirmedPlayerIds.filter(id => id !== playerId)
          : [...match.confirmedPlayerIds, playerId],
        teamA: newTeamA,
        teamB: newTeamB
      };

      if (selectedMatch?.id === matchId) {
        setSelectedMatch(updatedMatch);
      }
      await onSave(updatedMatch);
    } finally {
      setUpdatingPresenceFor(null);
      setIsSaving(false); // Reset isSaving
    }
  };

  const toggleArrival = async (matchId: string, playerId: string) => {
    if (!selectedMatch || !isAdmin || isSaving) return; // Added isSaving check
    if (updatingArrivalFor === playerId) return; // Proteção contra duplo clique

    try {
      setIsSaving(true); // Set isSaving
      setUpdatingArrivalFor(playerId);
      const currentArrived = selectedMatch.arrivedPlayerIds || [];
      let newArrived: string[];

      if (currentArrived.includes(playerId)) {
        newArrived = currentArrived.filter(id => id !== playerId);
      } else {
        newArrived = [...currentArrived, playerId];
      }

      const updatedMatch = { ...selectedMatch, arrivedPlayerIds: newArrived };
      setSelectedMatch(updatedMatch);
      await onSave(updatedMatch);
    } finally {
      setUpdatingArrivalFor(null);
      setIsSaving(false); // Reset isSaving
    }
  };

  const togglePayment = async (matchId: string, playerId: string) => {
    if (!isAdmin || isSaving) return; // Added isSaving check
    if (updatingPaymentFor === playerId) return; // Proteção contra duplo clique

    try {
      setIsSaving(true); // Set isSaving
      setUpdatingPaymentFor(playerId);
      const match = matches.find(m => m.id === matchId);
      const field = fields.find(f => f.id === match?.fieldId);
      if (!match || !field) return;

      const paidList = match.paidPlayerIds || [];
      const isPaid = paidList.includes(playerId);

      const newPaidList = isPaid ? paidList.filter(id => id !== playerId) : [...paidList, playerId];

      const updatedMatch: Match = {
        ...match,
        paidPlayerIds: newPaidList
      };

      if (selectedMatch?.id === matchId) {
        setSelectedMatch(updatedMatch);
      }
      await onSave(updatedMatch);

      // --- FINANCIAL SYNC ---
      const confirmedCount = updatedMatch.confirmedPlayerIds.length;
      const costPerPersonSync = calculateCostPerPlayer(updatedMatch);

      // Filtra apenas jogadores que NÃO são mensalistas para compor a receita da pelada
      const nonMonthlyPaidCount = players.filter(p =>
        newPaidList.includes(p.id) && !p.isMonthlySubscriber
      ).length;

      if (confirmedCount > 0 && costPerPersonSync > 0) {
        const totalAmount = nonMonthlyPaidCount * costPerPersonSync;
        const description = `Jogadores Avulso : ${field.name}`;
        await storage.transactions.upsertMatchTransaction(
          activeGroupId,
          matchId,
          totalAmount,
          description,
          match.date
        );
      }
    } finally {
      setUpdatingPaymentFor(null);
      setIsSaving(false); // Reset isSaving
    }
  };

  const addExistingGuest = async (playerId: string) => {
    if (!isAdmin || isSaving) return; // Added isSaving check
    if (!selectedMatch) return;
    if (selectedMatch.confirmedPlayerIds.includes(playerId)) {
      setIsGuestPickerOpen(false);
      return;
    }
    try {
      setIsSaving(true); // Set isSaving
      const updated: Match = {
        ...selectedMatch,
        confirmedPlayerIds: [...selectedMatch.confirmedPlayerIds, playerId]
      };
      await onSave(updated);
      setSelectedMatch(updated);
      setIsGuestPickerOpen(false);
    } finally {
      setIsSaving(false); // Reset isSaving
    }
  };

  const balanceTeamsManual = (playersToBalance: Player[]): { teamAIds: string[]; teamBIds: string[]; reasoning: string } => {
    // UPDATED: Distribuir apenas jogadores de linha usando padrão snake (A, B, B, A...) para maior equilíbrio
    const others = playersToBalance.filter(p => p.position !== Position.GOLEIRO)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    const teamAIds: string[] = [];
    const teamBIds: string[] = [];

    others.forEach((p, index) => {
      const groupOfFourIndex = index % 4;
      if (groupOfFourIndex === 0 || groupOfFourIndex === 3) {
        teamAIds.push(p.id);
      } else {
        teamBIds.push(p.id);
      }
    });

    return {
      teamAIds,
      teamBIds,
      reasoning: "Equilíbrio manual baseado em nível técnico (Padrão Snake). Goleiros devem ser adicionados manualmente."
    };
  };

  const handleGenerateTeams = async (match: Match | null) => {
    console.log("Iniciando geração de times...", { isAdmin, isBalancing, isSaving, outfieldPlayers });
    if (!isAdmin || isBalancing || isSaving || !match) return;

    // Total de jogadores de linha por time
    const totalNeeded = outfieldPlayers * 2;

    const currentArrivedIds = match?.arrivedPlayerIds || [];

    // Filtra apenas jogadores de linha na fila
    const arrivedOutfielderIds = currentArrivedIds.filter(id => {
      const p = players.find(player => player.id === id);
      return p && p.position !== Position.GOLEIRO;
    });

    if (arrivedOutfielderIds.length < totalNeeded) {
      alert(`Para ${outfieldPlayers} de linha, você precisa de pelo menos ${totalNeeded} jogadores de linha presentes (Goleiros não contam).`);
      return;
    }

    // Pega os primeiros jogadores de linha na fila que respeitam a ordem de chegada
    const matchOutfielderIds = arrivedOutfielderIds.slice(0, totalNeeded);
    const matchPlayers = players.filter(p => matchOutfielderIds.includes(p.id));

    setIsBalancing(true);
    setIsSaving(true);
    setAiReasoning(null);

    try {
      console.log(`Calculando próximo jogo...`);

      let tA: Player[] = [];
      let tB: Player[] = [];
      let reasoning = "Equilíbrio manual baseado em nível técnico (Padrão Snake).";

      if (subMatches.length === 0) {
        // --- PRIMEIRO JOGO DO DIA ---
        // Pega os primeiros 2N jogadores de linha para equilibrar
        const firstTwoTeamsIds = arrivedOutfielderIds.slice(0, outfieldPlayers * 2);
        const matchPlayers = players.filter(p => firstTwoTeamsIds.includes(p.id));

        const balanced = balanceTeamsManual(matchPlayers);
        tA = matchPlayers.filter(p => balanced.teamAIds.includes(p.id));
        tB = matchPlayers.filter(p => balanced.teamBIds.includes(p.id));
        reasoning = balanced.reasoning;
      } else {
        // --- ROTAÇÃO (REI DA QUADRA) ---
        const lastSM = subMatches[subMatches.length - 1];
        const prevSM = subMatches.length > 1 ? subMatches[subMatches.length - 2] : null;

        let stayingPlayers: Player[] = [];
        let incomingFromLast: Player[] = [];

        if (!prevSM) {
          // Após o Jogo 1: O vencedor fica (ou Time A em empate)
          if (lastSM.scoreB > lastSM.scoreA) {
            stayingPlayers = lastSM.teamB;
            incomingFromLast = lastSM.teamB;
          } else {
            stayingPlayers = lastSM.teamA;
            incomingFromLast = lastSM.teamB; // Assumimos B como entrante no J1
          }
        } else {
          // Após Jogo 2+: Quem jogou 2 seguidas sai. Quem jogou 1 fica.
          const wasInPrev = (pId: string) => prevSM.teamA.some(p => p.id === pId) || prevSM.teamB.some(p => p.id === pId);

          const teamAPlayedTwo = lastSM.teamA.some(p => wasInPrev(p.id));
          const teamBPlayedTwo = lastSM.teamB.some(p => wasInPrev(p.id));

          if (teamAPlayedTwo && !teamBPlayedTwo) {
            stayingPlayers = lastSM.teamB;
            incomingFromLast = lastSM.teamB;
          } else if (teamBPlayedTwo && !teamAPlayedTwo) {
            stayingPlayers = lastSM.teamA;
            incomingFromLast = lastSM.teamA;
          } else {
            // Caso ambos tenham jogado 1 (ex: mudança manual radical) ou ambos 2, vencedor do último fica
            stayingPlayers = (lastSM.scoreB > lastSM.scoreA) ? lastSM.teamB : lastSM.teamA;
            incomingFromLast = stayingPlayers;
          }
        }

        tA = stayingPlayers;

        // Acha onde parou na fila para o próximo time (Time B)
        // Usamos o time que entrou por último no jogo anterior como referência
        const lastInQueue = arrivedOutfielderIds.reduce((maxIdx, id) => {
          if (incomingFromLast.some(p => p.id === id)) {
            const idx = arrivedOutfielderIds.indexOf(id);
            return Math.max(maxIdx, idx);
          }
          return maxIdx;
        }, -1);

        // Gera o Time B buscando os próximos N disponíveis
        const teamBIds: string[] = [];
        let cursor = (lastInQueue + 1) % arrivedOutfielderIds.length;
        let attempts = 0;

        while (teamBIds.length < outfieldPlayers && attempts < arrivedOutfielderIds.length) {
          const pid = arrivedOutfielderIds[cursor];
          // Só adiciona se não estiver já no time que ficou
          if (!tA.some(p => p.id === pid)) {
            teamBIds.push(pid);
          }
          cursor = (cursor + 1) % arrivedOutfielderIds.length;
          attempts++;
        }

        tB = players.filter(p => teamBIds.includes(p.id))
          .sort((a, b) => teamBIds.indexOf(a.id) - teamBIds.indexOf(b.id));
        reasoning = `Rotação automática: Time que ficou + Próximos ${outfieldPlayers} da fila.`;
      }

      const newSubMatch: SubMatch = {
        id: genSafeId('submatch'),
        name: `Jogo ${subMatches.length + 1}`,
        teamA: tA,
        teamB: tB,
        scoreA: 0,
        scoreB: 0,
        finished: false
      };

      const newSubMatches = [...subMatches, newSubMatch];
      setSubMatches(newSubMatches);
      setAiReasoning(reasoning);

      const updatedMatch = { ...match, teamA: tA, teamB: tB, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
      console.log("Próximo jogo gerado com sucesso respeitando a rotação de 2 partidas.");

    } catch (error: any) {
      console.error("Erro ao gerar partida:", error);
      alert(`Erro ao gerar times: ${error?.message || 'Tente novamente.'}`);
    } finally {
      setIsBalancing(false);
      setIsSaving(false);
    }
  };

  const handleUpdateSubMatchScore = async (subMatchId: string, team: 'A' | 'B', score: number) => {
    if (!selectedMatch) return;
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      return {
        ...sm,
        scoreA: team === 'A' ? score : sm.scoreA,
        scoreB: team === 'B' ? score : sm.scoreB,
      };
    });
    setSubMatches(newSubMatches);
    const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
    await onSave(updatedMatch);
    // Note: No setSelectedMatch here to avoid potential feedback loops if not needed, 
    // but usually onSave returns the updated match or we assume success.
    // Given the flow, it's better to keep local state updated.
  };

  const handleFinishSubMatch = async (subMatchId: string) => {
    if (!selectedMatch || !window.confirm('Deseja realmente encerrar este jogo?')) {
      setActiveSubMatchMenuId(null);
      return;
    }
    try {
      const newSubMatches = subMatches.map(sm =>
        sm.id === subMatchId ? { ...sm, finished: true } : sm
      );
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error("Erro ao encerrar subpartida:", err);
    } finally {
      setActiveSubMatchMenuId(null);
    }
  };

  const handleCancelSubMatch = async (subMatchId: string) => {
    if (!selectedMatch || !window.confirm('Tem certeza que deseja cancelar (excluir) este jogo?')) {
      setActiveSubMatchMenuId(null);
      return;
    }
    try {
      const newSubMatches = subMatches.filter(sm => sm.id !== subMatchId);
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error("Erro ao cancelar subpartida:", err);
    } finally {
      setActiveSubMatchMenuId(null);
    }
  };

  const handleReactivateSubMatch = async (subMatchId: string) => {
    if (!selectedMatch) return;
    try {
      const newSubMatches = subMatches.map(sm =>
        sm.id === subMatchId ? { ...sm, finished: false } : sm
      );
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error("Erro ao reativar subpartida:", err);
    } finally {
      setActiveSubMatchMenuId(null);
    }
  };

  const handleUpdatePlayerGoals = async (subMatchId: string, playerId: string, team: 'A' | 'B', delta: number) => {
    if (!selectedMatch) return;
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      const goals = { ...(sm.goals || {}) };
      const currentGoals = goals[playerId] || 0;
      const nextGoals = Math.max(0, currentGoals + delta);

      if (nextGoals === currentGoals) return sm;

      goals[playerId] = nextGoals;

      return {
        ...sm,
        goals,
        scoreA: team === 'A' ? Math.max(0, sm.scoreA + delta) : sm.scoreA,
        scoreB: team === 'B' ? Math.max(0, sm.scoreB + delta) : sm.scoreB,
      };
    });
    setSubMatches(newSubMatches);
    await onSave({ ...selectedMatch, subMatches: newSubMatches });
  };

  const handleUpdatePlayerAssists = async (subMatchId: string, playerId: string, delta: number) => {
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      const assists = { ...(sm.assists || {}) };
      const currentAssists = assists[playerId] || 0;
      const nextAssists = Math.max(0, currentAssists + delta);

      if (nextAssists === currentAssists && delta !== 0) return sm;

      assists[playerId] = nextAssists;
      return { ...sm, assists };
    });
    setSubMatches(newSubMatches);
    await onSave({ ...selectedMatch, subMatches: newSubMatches });
  };

  const handleRemovePlayerFromSubMatch = async (subMatchId: string, team: 'A' | 'B', playerId: string) => {
    if (!selectedMatch) return;
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      return {
        ...sm,
        teamA: team === 'A' ? sm.teamA.filter(p => p.id !== playerId) : sm.teamA,
        teamB: team === 'B' ? sm.teamB.filter(p => p.id !== playerId) : sm.teamB,
      };
    });
    setSubMatches(newSubMatches);
    await onSave({ ...selectedMatch, subMatches: newSubMatches });
  };

  const handleAddPlayerToSubMatch = async (subMatchId: string, team: 'A' | 'B', player: Player) => {
    if (!selectedMatch) return;

    // Verificar se o time já está completo
    const targetSM = subMatches.find(sm => sm.id === subMatchId);
    if (targetSM) {
      const currentTeam = team === 'A' ? targetSM.teamA : targetSM.teamB;
      if (player.position !== Position.GOLEIRO) {
        const linePlayers = currentTeam.filter(p => p.position !== Position.GOLEIRO);
        if (linePlayers.length >= outfieldPlayers) {
          return;
        }
      } else {
        const hasGoleiro = currentTeam.some(p => p.position === Position.GOLEIRO);
        if (hasGoleiro) {
          return;
        }
      }
    }

    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      if (sm.teamA.some(p => p.id === player.id) || sm.teamB.some(p => p.id === player.id)) return sm;
      return {
        ...sm,
        teamA: team === 'A' ? [...sm.teamA, player] : sm.teamA,
        teamB: team === 'B' ? [...sm.teamB, player] : sm.teamB,
      };
    });
    setSubMatches(newSubMatches);
    await onSave({ ...selectedMatch, subMatches: newSubMatches });
  };

  const handleDragStart = (playerId: string, subMatchId: string, fromTeam: 'A' | 'B') => {
    if (!isAdmin) return;
    setDraggingPlayer({ playerId, subMatchId, fromTeam });
  };

  const handleDragOver = (e: React.DragEvent, subMatchId: string, team: 'A' | 'B') => {
    e.preventDefault();
    if (draggingPlayer && draggingPlayer.subMatchId === subMatchId && draggingPlayer.fromTeam !== team) {
      setDragOverTeam({ subMatchId, team });
    }
  };

  const handleDrop = async (subMatchId: string, toTeam: 'A' | 'B') => {
    setDragOverTeam(null);
    if (!draggingPlayer || draggingPlayer.subMatchId !== subMatchId || draggingPlayer.fromTeam === toTeam) {
      setDraggingPlayer(null);
      return;
    }

    // Handle main match teams
    if (selectedMatch && subMatchId === selectedMatch.id) {
      const player = (draggingPlayer.fromTeam === 'A' ? selectedMatch.teamA : selectedMatch.teamB).find(p => p.id === draggingPlayer.playerId);
      if (!player) {
        setDraggingPlayer(null);
        return;
      }

      // Validar limite ao mover para o outro time
      if (draggingPlayer.fromTeam !== toTeam) {
        const targetTeam = toTeam === 'A' ? selectedMatch.teamA : selectedMatch.teamB;
        if (player.position !== Position.GOLEIRO) {
          if (targetTeam.filter(p => p.position !== Position.GOLEIRO).length >= outfieldPlayers) {
            setDraggingPlayer(null);
            setDragOverTeam(null);
            return;
          }
        } else if (targetTeam.some(p => p.position === Position.GOLEIRO)) {
          setDraggingPlayer(null);
          setDragOverTeam(null);
          return;
        }
      }

      const newTeamA = draggingPlayer.fromTeam === 'A'
        ? selectedMatch.teamA.filter(p => p.id !== draggingPlayer.playerId)
        : [...selectedMatch.teamA, player];

      const newTeamB = draggingPlayer.fromTeam === 'B'
        ? selectedMatch.teamB.filter(p => p.id !== draggingPlayer.playerId)
        : [...selectedMatch.teamB, player];

      const updatedMatch = { ...selectedMatch, teamA: newTeamA, teamB: newTeamB };
      setSelectedMatch(updatedMatch);
      await onSave(updatedMatch);
      setDraggingPlayer(null);
      return;
    }

    let blocked = false;
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;

      const player = (draggingPlayer.fromTeam === 'A' ? sm.teamA : sm.teamB).find(p => p.id === draggingPlayer.playerId);
      if (!player) return sm;

      // Validar limite ao mover para o outro time dentro de uma subpartida
      if (draggingPlayer.fromTeam !== toTeam) {
        const targetTeam = toTeam === 'A' ? sm.teamA : sm.teamB;
        if (player.position !== Position.GOLEIRO) {
          if (targetTeam.filter(p => p.position !== Position.GOLEIRO).length >= outfieldPlayers) {
            blocked = true;
            return sm;
          }
        } else if (targetTeam.some(p => p.position === Position.GOLEIRO)) {
          blocked = true;
          return sm;
        }
      }

      const newTeamA = draggingPlayer.fromTeam === 'A'
        ? sm.teamA.filter(p => p.id !== draggingPlayer.playerId)
        : [...sm.teamA, player];

      const newTeamB = draggingPlayer.fromTeam === 'B'
        ? sm.teamB.filter(p => p.id !== draggingPlayer.playerId)
        : [...sm.teamB, player];

      return { ...sm, teamA: newTeamA, teamB: newTeamB };
    });

    if (blocked) {
      setDraggingPlayer(null);
      setDragOverTeam(null);
      return;
    }

    setSubMatches(newSubMatches);
    if (selectedMatch) {
      await onSave({ ...selectedMatch, subMatches: newSubMatches });
    }

    setDraggingPlayer(null);
  };

  const handleTouchStart = (playerId: string, subMatchId: string, fromTeam: 'A' | 'B', e: React.TouchEvent) => {
    if (!isAdmin) return;
    const touch = e.touches[0];
    setDraggingPlayer({ playerId, subMatchId, fromTeam });
    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false); // Only start moving after a small movement to allow scroll
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingPlayer || !touchDragPosition) return;
    const touch = e.touches[0];

    // Prevent scrolling when dragging
    if (Math.abs(touch.clientX - touchDragPosition.x) > 10 || Math.abs(touch.clientY - touchDragPosition.y) > 10) {
      if (e.cancelable) e.preventDefault();
      setIsTouchDragging(true);
    }

    if (!isTouchDragging) return;

    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });

    // Detect drop target
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = element?.closest('[data-drop-zone]');
    if (dropZone) {
      const smId = dropZone.getAttribute('data-submatch-id');
      const team = dropZone.getAttribute('data-drop-zone') as 'A' | 'B';
      if (smId === draggingPlayer.subMatchId && team !== draggingPlayer.fromTeam) {
        setDragOverTeam({ subMatchId: smId, team });
      } else {
        setDragOverTeam(null);
      }
    } else {
      setDragOverTeam(null);
    }
  };

  const handleTouchEnd = () => {
    if (!draggingPlayer) return;
    if (dragOverTeam) {
      handleDrop(dragOverTeam.subMatchId, dragOverTeam.team);
    } else {
      setDraggingPlayer(null);
      setDragOverTeam(null);
    }
    setTouchDragPosition(null);
    setIsTouchDragging(false);
  };

  const handleFinishMatch = async () => {
    if (!selectedMatch || !isAdmin || isSaving) return;

    const updatedMatch = {
      ...selectedMatch,
      finished: true,
      scoreA: selectedMatch.scoreA, // Use current scores if stored or 0
      scoreB: selectedMatch.scoreB,
      mvpId: undefined
    };

    try {
      setIsSaving(true);
      await onSave(updatedMatch);

      // Gerar transação automática de saída para o aluguel do campo
      const field = fields.find(f => f.id === selectedMatch.fieldId);
      if (field) {
        const fieldExpense = {
          id: genSafeId('expense'),
          groupId: activeGroupId,
          description: `Pagamento de Campo/Quadra : ${field.name}`,
          amount: field.hourlyRate,
          type: 'EXPENSE' as const,
          category: 'FIELD_RENT' as const,
          date: selectedMatch.date, // Data do jogo
          relatedMatchId: selectedMatch.id
        };
        await storage.transactions.save(fieldExpense as any);
      }

      // Gerar/Atualizar transação automática de entrada para os pagamentos dos jogadores
      // Filtra apenas jogadores que NÃO são mensalistas para entrar na receita avulsa da pelada
      const nonMonthlyPaidCount = players.filter(p =>
        (selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber
      ).length;

      const costPerPerson = calculateCostPerPlayer(selectedMatch);
      if (field && nonMonthlyPaidCount > 0) {
        const totalIncome = nonMonthlyPaidCount * costPerPerson;
        const incomeDescription = `Jogadores Avulso : ${field.name}`;
        await storage.transactions.upsertMatchTransaction(
          activeGroupId,
          selectedMatch.id,
          totalIncome,
          incomeDescription,
          selectedMatch.date
        );
      }

      setIsFinishing(false);
      setSelectedMatch(null);
      setView('list');
    } finally {
      setIsSaving(false);
    }
  };


  const calculateCostPerPlayer = (match: Match) => {
    const field = fields.find(f => f.id === match.fieldId);
    if (!field || match.confirmedPlayerIds.length === 0) return 0;
    const mode = activeGroup.paymentMode || 'fixed';
    if (mode === 'fixed') {
      const amt = Number(activeGroup.fixedAmount || 0);
      return amt > 0 ? amt : 0;
    }
    if (field.hourlyRate <= 0) return 0;
    return field.hourlyRate / match.confirmedPlayerIds.length;
  };

  const calculateTotalCollected = (match: Match) => {
    const costPerPerson = calculateCostPerPlayer(match);
    if (!costPerPerson) return 0;
    return (match.paidPlayerIds?.length || 0) * costPerPerson;
  };

  const shareOnWhatsApp = (match: Match) => {
    const field = fields.find(f => f.id === match.fieldId);
    const cost = calculateCostPerPlayer(match);

    let text = `⚽ *FUTGOL - Jogo Confirmado!*\n`;
    text += `📅 ${match.date.split('-').reverse().join('/')} às ${match.time}\n`;
    text += `📍 ${field?.name || 'Local a definir'}\n`;
    if (cost > 0) {
      const mode = activeGroup.paymentMode || 'split';
      text += mode === 'fixed'
        ? `💰 Valor fixo: R$ ${cost.toFixed(2)} por pessoa\n`
        : `💰 Estimado: R$ ${cost.toFixed(2)} por pessoa (divisão)\n`;
    }
    text += `\n`;

    if (match.teamA.length > 0) {
      text += `🔵 *TIME A (Colete)*\n`;
      match.teamA.forEach(p => text += `• ${getDisplayName(p)}\n`);
      text += `\n`;
    }

    if (match.teamB.length > 0) {
      text += `🔴 *TIME B (Sem Colete)*\n`;
      match.teamB.forEach(p => text += `• ${getDisplayName(p)}\n`);
    }

    if (match.teamA.length === 0 && match.teamB.length === 0) {
      text += `✅ *Confirmados (${match.confirmedPlayerIds.length}):*\n`;
      players
        .filter(p => match.confirmedPlayerIds.includes(p.id))
        .forEach(p => text += `• ${getDisplayName(p)}\n`);
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  // --- QUEUE VIEW (ARRIVAL CONTROL) ---
  if (view === 'queue' && selectedMatch) {
    return (
      <div className="space-y-6 animate-fade-in relative mb-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView('details')}
          className="flex items-center gap-1 text-navy-500 hover:text-brand-600 pl-0"
          leftIcon={<span className="text-xl">←</span>}
        >
          Voltar para o jogo
        </Button>

        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-navy-900 tracking-tight">Controle de Chegada</h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 rounded-xl border border-brand-100">
              <span className="text-brand-600 font-bold text-lg">{(selectedMatch.arrivedPlayerIds || []).length}</span>
              <span className="text-xs text-brand-500 uppercase font-black tracking-widest">Presentes</span>
            </div>
          </div>
          <p className="text-sm text-navy-500 font-medium">Separação por status de chegada. Clique no nome para alternar.</p>
        </header>

        {(() => {
          const confirmedPlayers = players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
          const arrivedIds = selectedMatch.arrivedPlayerIds || [];

          const waitingPlayers = confirmedPlayers
            .filter(p => !arrivedIds.includes(p.id))
            .sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));

          const arrivedPlayers = arrivedIds
            .map(id => confirmedPlayers.find(p => p.id === id))
            .filter((p): p is Player => !!p);

          return (
            <div className="grid grid-cols-2 gap-3 sm:gap-8 items-start">
              {/* Coluna da Esquerda: Aguardando */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-[9px] sm:text-xs font-black text-navy-400 uppercase tracking-widest sm:tracking-[0.2em] px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-200"></span>
                  Confirmados ({waitingPlayers.length})
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[50vh] sm:max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-navy-200">
                  {waitingPlayers.map(player => {
                    const positionColor =
                      player.position === Position.GOLEIRO ? 'border-l-red-500' :
                        player.position === Position.DEFENSOR ? 'border-l-orange-500' :
                          player.position === Position.MEIO ? 'border-l-blue-500' :
                            'border-l-green-500';

                    return (
                      <div
                        key={player.id}
                        onClick={() => isAdmin && toggleArrival(selectedMatch.id, player.id)}
                        className={cn(
                          "p-3 sm:p-4 rounded-r-xl sm:rounded-r-2xl border-2 border-navy-100 border-l-[6px] sm:border-l-8 bg-white active:bg-navy-50 shadow-sm transition-all flex items-center justify-between cursor-pointer select-none group",
                          positionColor
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-navy-900 text-sm sm:text-lg truncate">
                              {player.nickname || player.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[9px] sm:text-[10px] uppercase font-bold tracking-tighter truncate px-1 rounded",
                                player.position === Position.GOLEIRO ? "bg-red-50 text-red-600" :
                                  player.position === Position.DEFENSOR ? "bg-orange-50 text-orange-600" :
                                    player.position === Position.MEIO ? "bg-blue-50 text-blue-600" :
                                      "bg-green-50 text-green-600"
                              )}>
                                {player.position}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {waitingPlayers.length === 0 && (
                    <div className="py-8 sm:py-12 text-center border-2 border-dashed border-navy-50 rounded-2xl sm:rounded-3xl text-navy-300 text-[10px] sm:text-sm italic bg-navy-50/20 px-2">
                      Vazio! ⚽
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna da Direita: Já Chegaram */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-[9px] sm:text-xs font-black text-brand-600 uppercase tracking-widest sm:tracking-[0.2em] px-1">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                  Presentes ({arrivedPlayers.length})
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[50vh] sm:max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-200">
                  {arrivedPlayers.map((player, index) => {
                    const positionColor =
                      player.position === Position.GOLEIRO ? 'border-l-red-500' :
                        player.position === Position.DEFENSOR ? 'border-l-orange-500' :
                          player.position === Position.MEIO ? 'border-l-blue-500' :
                            'border-l-green-500';

                    return (
                      <div
                        key={player.id}
                        onClick={() => isAdmin && toggleArrival(selectedMatch.id, player.id)}
                        className={cn(
                          "p-3 sm:p-4 rounded-r-xl sm:rounded-r-2xl border-2 border-navy-100 border-l-[6px] sm:border-l-8 bg-white shadow-md active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer select-none group",
                          positionColor
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-navy-900 text-sm sm:text-lg truncate">
                              {player.nickname || player.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[9px] sm:text-[10px] uppercase font-bold tracking-tighter truncate px-1 rounded",
                                player.position === Position.GOLEIRO ? "bg-red-50 text-red-600" :
                                  player.position === Position.DEFENSOR ? "bg-orange-50 text-orange-600" :
                                    player.position === Position.MEIO ? "bg-blue-50 text-blue-600" :
                                      "bg-green-50 text-green-600"
                              )}>
                                {player.position}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-navy-900 text-white flex items-center justify-center font-black shadow-lg text-[10px] sm:text-sm shrink-0">
                          {index + 1}
                        </div>
                      </div>
                    );
                  })}
                  {arrivedPlayers.length === 0 && (
                    <div className="py-8 sm:py-12 text-center border-2 border-dashed border-navy-50 rounded-2xl sm:rounded-3xl text-navy-300 text-[10px] sm:text-sm italic bg-navy-50/20 px-2">
                      Fila vazia...
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-4 p-4 bg-navy-50 rounded-2xl border border-navy-100 shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏃</span>
              <label className="text-sm font-black text-navy-700 uppercase tracking-wider">Jogadores de linha</label>
            </div>
            <select
              value={outfieldPlayers}
              onChange={(e) => setOutfieldPlayers(Number(e.target.value))}
              className="bg-white border-2 border-navy-200 rounded-xl px-4 py-2 text-navy-900 font-black focus:border-brand-500 focus:outline-none transition-all shadow-sm"
            >
              {[4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} por time</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <Button
              variant="ghost"
              className="flex-1 h-16 rounded-2xl font-bold text-lg"
              onClick={() => { setView('details'); }}
            >
              Voltar
            </Button>
            <Button
              className="flex-[2] h-16 rounded-2xl font-black text-lg shadow-xl shadow-brand-600/20"
              onClick={() => handleGenerateTeams(selectedMatch)}
              isLoading={isBalancing}
              disabled={(selectedMatch.arrivedPlayerIds || []).length < 2}
            >
              🚀 Gerar Partida
            </Button>
          </div>

          {/* Listagem de Jogos Gerados */}
          {subMatches.length > 0 && (
            <div className="mt-8 space-y-6 animate-fade-in-up pb-10">
              <h4 className="text-xl font-black text-navy-900 flex items-center gap-2">
                <span className="w-2 h-8 bg-brand-500 rounded-full"></span>
                Histórico de Jogos
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {subMatches.slice().reverse().map((sm) => (
                  <Card key={sm.id} className={cn("p-0 overflow-visible border-2 transition-all", sm.finished ? "border-navy-200 opacity-80" : "border-navy-100 shadow-md")}>
                    <div className={cn("p-3 flex justify-between items-center transition-colors rounded-t-2xl", sm.finished ? "bg-navy-700" : "bg-navy-900")}>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-black uppercase tracking-widest text-sm">{sm.name}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {sm.finished ? (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-navy-400"></span>
                            <span className="text-[10px] text-navy-300 font-black uppercase tracking-tighter">Encerrado</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] text-navy-300 font-black uppercase tracking-tighter">Em andamento</span>
                          </div>
                        )}

                        {isAdmin && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSubMatchMenuId(activeSubMatchMenuId === sm.id ? null : sm.id);
                              }}
                              className="p-1 hover:bg-white/10 rounded-full transition-colors text-white"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </button>

                            {activeSubMatchMenuId === sm.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveSubMatchMenuId(null); }} />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-navy-100 z-50 overflow-hidden py-1 animate-fade-in">
                                  {!sm.finished ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleFinishSubMatch(sm.id); }}
                                      className="w-full px-4 py-2 text-left text-sm font-bold text-navy-700 hover:bg-navy-50 flex items-center gap-2"
                                    >
                                      🏁 Encerrar Jogo
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReactivateSubMatch(sm.id); }}
                                      className="w-full px-4 py-2 text-left text-sm font-bold text-navy-700 hover:bg-navy-50 flex items-center gap-2"
                                    >
                                      🔄 Reativar Jogo
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCancelSubMatch(sm.id); }}
                                    className="w-full px-4 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    🗑️ Cancelar Jogo
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      {/* Placar Centralizado */}
                      <div className="absolute left-1/2 top-0.5 -translate-x-1/2 z-10 flex items-center bg-navy-900 rounded-full border-1 border-navy-700 shadow-xl overflow-hidden">
                        <input
                          type="number"
                          className="w-10 h-10 bg-transparent text-white font-black text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-lg"
                          value={sm.scoreA}
                          onChange={(e) => handleUpdateSubMatchScore(sm.id, 'A', Number(e.target.value))}
                          disabled={sm.finished || !isAdmin}
                        />
                        <span className="text-navy-400 font-bold px-1 text-xs select-none">x</span>
                        <input
                          type="number"
                          className="w-10 h-10 bg-transparent text-white font-black text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-lg"
                          value={sm.scoreB}
                          onChange={(e) => handleUpdateSubMatchScore(sm.id, 'B', Number(e.target.value))}
                          disabled={sm.finished || !isAdmin}
                        />
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-navy-100">
                        {/* Time A */}
                        <div
                          className={cn(
                            "p-4 space-y-3 transition-colors duration-200",
                            !sm.finished && dragOverTeam?.subMatchId === sm.id && dragOverTeam?.team === 'A' ? "bg-brand-50/50" : ""
                          )}
                          data-drop-zone={!sm.finished ? "A" : undefined}
                          data-submatch-id={sm.id}
                          onDragOver={(e) => !sm.finished && handleDragOver(e, sm.id, 'A')}
                          onDragLeave={() => setDragOverTeam(null)}
                          onDrop={() => !sm.finished && handleDrop(sm.id, 'A')}
                        >
                          <h5 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mb-4 text-center">Time 1</h5>

                          {/* Slot de Goleiro dedicado */}
                          <div className="mb-4">
                            {(() => {
                              const gk = sm.teamA.find(p => p.position === Position.GOLEIRO);
                              if (gk) {
                                return (
                                  <div
                                    className={cn(
                                      "group/player flex items-center justify-between bg-red-50 p-2.5 sm:p-2 rounded-lg border-2 border-red-200 shadow-sm relative",
                                      sm.finished ? "opacity-60" : "",
                                      activePlayerMenu?.playerId === gk.id ? "z-30" : "z-10"
                                    )}
                                    draggable={isAdmin && !sm.finished}
                                    onDragStart={() => !sm.finished && handleDragStart(gk.id, sm.id, 'A')}
                                    onDragEnd={() => { setDraggingPlayer(null); setDragOverTeam(null); }}
                                    onTouchStart={(e) => !sm.finished && handleTouchStart(gk.id, sm.id, 'A', e)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-6 rounded-full bg-red-600 shrink-0"></span>
                                      <span className="text-[11px] sm:text-xs font-black text-red-700 truncate">{gk.nickname || gk.name} (G)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {sm.goals?.[gk.id] && (
                                        <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1 rounded flex items-center gap-0.5">
                                          ⚽ {sm.goals[gk.id]}
                                        </span>
                                      )}
                                      {sm.assists?.[gk.id] && (
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-0.5">
                                          👟 {sm.assists[gk.id]}
                                        </span>
                                      )}
                                      {!sm.finished && isAdmin && (
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActivePlayerMenu(activePlayerMenu?.playerId === gk.id ? null : { subMatchId: sm.id, playerId: gk.id });
                                            }}
                                            className="p-1 text-navy-400 hover:text-navy-600 transition-colors"
                                          >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                            </svg>
                                          </button>
                                          {activePlayerMenu?.playerId === gk.id && activePlayerMenu?.subMatchId === sm.id && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setActivePlayerMenu(null)} />
                                              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-navy-100 z-50 overflow-hidden py-1">
                                                <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                                  <span className="text-xs font-bold text-navy-700">⚽ Gol</span>
                                                  <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdatePlayerGoals(sm.id, gk.id, 'A', -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                    <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.goals?.[gk.id] || 0}</span>
                                                    <button onClick={() => handleUpdatePlayerGoals(sm.id, gk.id, 'A', 1)} className="w-5 h-5 flex items-center justify-center bg-brand-50 rounded text-brand-600 hover:bg-brand-100 transition-colors">+</button>
                                                  </div>
                                                </div>
                                                <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                                  <span className="text-xs font-bold text-navy-700">👟 Assist.</span>
                                                  <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdatePlayerAssists(sm.id, gk.id, -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                    <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.assists?.[gk.id] || 0}</span>
                                                    <button onClick={() => handleUpdatePlayerAssists(sm.id, gk.id, 1)} className="w-5 h-5 flex items-center justify-center bg-blue-50 rounded text-blue-600 hover:bg-blue-100 transition-colors">+</button>
                                                  </div>
                                                </div>
                                                <button onClick={() => handleRemovePlayerFromSubMatch(sm.id, 'A', gk.id)} className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-navy-50">❌ Remover</button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              if (sm.finished) return null;
                              return (
                                <div className="relative">
                                  <select
                                    onChange={(e) => {
                                      const p = players.find(pl => pl.id === e.target.value);
                                      if (p) handleAddPlayerToSubMatch(sm.id, 'A', p);
                                      e.target.value = "";
                                    }}
                                    className="w-full text-[10px] font-black text-center bg-red-50 border-2 border-dashed border-red-200 text-red-500 p-2.5 sm:p-2 rounded-lg hover:border-red-400 hover:bg-red-100 transition-all appearance-none cursor-pointer"
                                    disabled={sm.finished}
                                  >
                                    <option value="">+ GOLEIRO</option>
                                    {players
                                      .filter(p => p.position === Position.GOLEIRO && (selectedMatch.arrivedPlayerIds || []).includes(p.id))
                                      .filter(p => !sm.teamA.some(tp => tp.id === p.id) && !sm.teamB.some(tp => tp.id === p.id))
                                      .map(p => (
                                        <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
                                      ))
                                    }
                                  </select>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-2">
                            {sm.teamA.filter(p => p.position !== Position.GOLEIRO).map(p => (
                              <div
                                key={p.id}
                                draggable={isAdmin && !sm.finished}
                                onDragStart={() => !sm.finished && handleDragStart(p.id, sm.id, 'A')}
                                onDragEnd={() => { setDraggingPlayer(null); setDragOverTeam(null); }}
                                onTouchStart={(e) => !sm.finished && handleTouchStart(p.id, sm.id, 'A', e)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={cn(
                                  "group/player flex items-center justify-between bg-white p-2.5 sm:p-2 rounded-lg border border-navy-100 transition-all shadow-sm relative",
                                  isAdmin && !sm.finished ? "cursor-grab active:cursor-grabbing touch-none" : "",
                                  sm.finished ? "opacity-60" : "hover:border-navy-200 hover:shadow-md",
                                  draggingPlayer?.playerId === p.id ? "opacity-40 scale-95" : "",
                                  activePlayerMenu?.playerId === p.id ? "z-30" : "z-10"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn(
                                    "w-1 h-5 sm:w-1.5 sm:h-6 rounded-full shrink-0",
                                    p.position === Position.GOLEIRO ? 'bg-red-500' :
                                      p.position === Position.DEFENSOR ? 'bg-orange-500' :
                                        p.position === Position.MEIO ? 'bg-blue-500' : 'bg-green-500'
                                  )}></span>
                                  <span className="text-[11px] sm:text-xs font-bold text-navy-800 truncate">{p.nickname || p.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {sm.goals?.[p.id] && (
                                    <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1 rounded flex items-center gap-0.5">
                                      ⚽ {sm.goals[p.id]}
                                    </span>
                                  )}
                                  {sm.assists?.[p.id] && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-0.5">
                                      👟 {sm.assists[p.id]}
                                    </span>
                                  )}
                                  {!sm.finished && isAdmin && (
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePlayerMenu(activePlayerMenu?.playerId === p.id ? null : { subMatchId: sm.id, playerId: p.id });
                                        }}
                                        className="p-1 text-navy-400 hover:text-navy-600 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                        </svg>
                                      </button>
                                      {activePlayerMenu?.playerId === p.id && activePlayerMenu?.subMatchId === sm.id && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setActivePlayerMenu(null)} />
                                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-navy-100 z-50 overflow-hidden py-1">
                                            <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                              <span className="text-xs font-bold text-navy-700">⚽ Gol</span>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdatePlayerGoals(sm.id, p.id, 'A', -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.goals?.[p.id] || 0}</span>
                                                <button onClick={() => handleUpdatePlayerGoals(sm.id, p.id, 'A', 1)} className="w-5 h-5 flex items-center justify-center bg-brand-50 rounded text-brand-600 hover:bg-brand-100 transition-colors">+</button>
                                              </div>
                                            </div>
                                            <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                              <span className="text-xs font-bold text-navy-700">👟 Assist.</span>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdatePlayerAssists(sm.id, p.id, -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.assists?.[p.id] || 0}</span>
                                                <button onClick={() => handleUpdatePlayerAssists(sm.id, p.id, 1)} className="w-5 h-5 flex items-center justify-center bg-blue-50 rounded text-blue-600 hover:bg-blue-100 transition-colors">+</button>
                                              </div>
                                            </div>
                                            <button onClick={() => handleRemovePlayerFromSubMatch(sm.id, 'A', p.id)} className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-navy-50">❌ Remover</button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {/* Botão de adicionar extra (linha) */}
                            {!sm.finished && isAdmin && (
                              <div className="relative pt-1 border-t border-navy-50 mt-2">
                                <select
                                  onChange={(e) => {
                                    const p = players.find(pl => pl.id === e.target.value);
                                    if (p) handleAddPlayerToSubMatch(sm.id, 'A', p);
                                    e.target.value = "";
                                  }}
                                  className="w-full text-[10px] font-bold text-center bg-gray-50 border border-dashed border-gray-200 text-gray-400 p-2 sm:p-1.5 rounded-lg hover:border-brand-300 hover:text-brand-500 transition-all appearance-none cursor-pointer"
                                >
                                  <option value="">+ JOGADOR</option>
                                  {players
                                    .filter(p => (selectedMatch.arrivedPlayerIds || []).includes(p.id))
                                    .filter(p => !sm.teamA.some(tp => tp.id === p.id) && !sm.teamB.some(tp => tp.id === p.id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.nickname || p.name} ({p.position})</option>
                                    ))
                                  }
                                </select>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Time B */}
                        <div
                          className={cn(
                            "p-4 space-y-3 transition-colors duration-200",
                            !sm.finished && dragOverTeam?.subMatchId === sm.id && dragOverTeam?.team === 'B' ? "bg-red-50/50" : ""
                          )}
                          data-drop-zone={!sm.finished ? "B" : undefined}
                          data-submatch-id={sm.id}
                          onDragOver={(e) => !sm.finished && handleDragOver(e, sm.id, 'B')}
                          onDragLeave={() => setDragOverTeam(null)}
                          onDrop={() => !sm.finished && handleDrop(sm.id, 'B')}
                        >
                          <h5 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 text-center">Time 2</h5>

                          {/* Slot de Goleiro dedicado */}
                          <div className="mb-4">
                            {(() => {
                              const gk = sm.teamB.find(p => p.position === Position.GOLEIRO);
                              if (gk) {
                                return (
                                  <div
                                    className={cn(
                                      "group/player flex items-center justify-between bg-red-50 p-2.5 sm:p-2 rounded-lg border-2 border-red-200 shadow-sm relative",
                                      sm.finished ? "opacity-60" : "",
                                      activePlayerMenu?.playerId === gk.id ? "z-30" : "z-10"
                                    )}
                                    draggable={isAdmin && !sm.finished}
                                    onDragStart={() => !sm.finished && handleDragStart(gk.id, sm.id, 'B')}
                                    onDragEnd={() => { setDraggingPlayer(null); setDragOverTeam(null); }}
                                    onTouchStart={(e) => !sm.finished && handleTouchStart(gk.id, sm.id, 'B', e)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-6 rounded-full bg-red-600 shrink-0"></span>
                                      <span className="text-[11px] sm:text-xs font-black text-red-700 truncate">{gk.nickname || gk.name} (G)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {sm.goals?.[gk.id] && (
                                        <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1 rounded flex items-center gap-0.5">
                                          ⚽ {sm.goals[gk.id]}
                                        </span>
                                      )}
                                      {sm.assists?.[gk.id] && (
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-0.5">
                                          👟 {sm.assists[gk.id]}
                                        </span>
                                      )}
                                      {!sm.finished && isAdmin && (
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActivePlayerMenu(activePlayerMenu?.playerId === gk.id ? null : { subMatchId: sm.id, playerId: gk.id });
                                            }}
                                            className="p-1 text-navy-400 hover:text-navy-600 transition-colors"
                                          >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                            </svg>
                                          </button>
                                          {activePlayerMenu?.playerId === gk.id && activePlayerMenu?.subMatchId === sm.id && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setActivePlayerMenu(null)} />
                                              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-navy-100 z-50 overflow-hidden py-1">
                                                <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                                  <span className="text-xs font-bold text-navy-700">⚽ Gol</span>
                                                  <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdatePlayerGoals(sm.id, gk.id, 'B', -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                    <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.goals?.[gk.id] || 0}</span>
                                                    <button onClick={() => handleUpdatePlayerGoals(sm.id, gk.id, 'B', 1)} className="w-5 h-5 flex items-center justify-center bg-brand-50 rounded text-brand-600 hover:bg-brand-100 transition-colors">+</button>
                                                  </div>
                                                </div>
                                                <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                                  <span className="text-xs font-bold text-navy-700">👟 Assist.</span>
                                                  <div className="flex items-center gap-2">
                                                    <button onClick={() => handleUpdatePlayerAssists(sm.id, gk.id, -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                    <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.assists?.[gk.id] || 0}</span>
                                                    <button onClick={() => handleUpdatePlayerAssists(sm.id, gk.id, 1)} className="w-5 h-5 flex items-center justify-center bg-blue-50 rounded text-blue-600 hover:bg-blue-100 transition-colors">+</button>
                                                  </div>
                                                </div>
                                                <button onClick={() => handleRemovePlayerFromSubMatch(sm.id, 'B', gk.id)} className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-navy-50">❌ Remover</button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              if (sm.finished) return null;
                              return (
                                <div className="relative">
                                  <select
                                    onChange={(e) => {
                                      const p = players.find(pl => pl.id === e.target.value);
                                      if (p) handleAddPlayerToSubMatch(sm.id, 'B', p);
                                      e.target.value = "";
                                    }}
                                    className="w-full text-[10px] font-black text-center bg-red-50 border-2 border-dashed border-red-200 text-red-500 p-2.5 sm:p-2 rounded-lg hover:border-red-400 hover:bg-red-100 transition-all appearance-none cursor-pointer"
                                    disabled={sm.finished}
                                  >
                                    <option value="">+ GOLEIRO</option>
                                    {players
                                      .filter(p => p.position === Position.GOLEIRO && (selectedMatch.arrivedPlayerIds || []).includes(p.id))
                                      .filter(p => !sm.teamA.some(tp => tp.id === p.id) && !sm.teamB.some(tp => tp.id === p.id))
                                      .map(p => (
                                        <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
                                      ))
                                    }
                                  </select>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-2">
                            {sm.teamB.filter(p => p.position !== Position.GOLEIRO).map(p => (
                              <div
                                key={p.id}
                                draggable={isAdmin && !sm.finished}
                                onDragStart={() => !sm.finished && handleDragStart(p.id, sm.id, 'B')}
                                onDragEnd={() => { setDraggingPlayer(null); setDragOverTeam(null); }}
                                onTouchStart={(e) => !sm.finished && handleTouchStart(p.id, sm.id, 'B', e)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={cn(
                                  "group/player flex items-center justify-between bg-white p-2.5 sm:p-2 rounded-lg border border-navy-100 transition-all shadow-sm relative",
                                  isAdmin && !sm.finished ? "cursor-grab active:cursor-grabbing touch-none" : "",
                                  sm.finished ? "opacity-60" : "hover:border-navy-200 hover:shadow-md",
                                  draggingPlayer?.playerId === p.id ? "opacity-40 scale-95" : "",
                                  activePlayerMenu?.playerId === p.id ? "z-30" : "z-10"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn(
                                    "w-1 h-5 sm:w-1.5 sm:h-6 rounded-full shrink-0",
                                    p.position === Position.GOLEIRO ? 'bg-red-500' :
                                      p.position === Position.DEFENSOR ? 'bg-orange-500' :
                                        p.position === Position.MEIO ? 'bg-blue-500' : 'bg-green-500'
                                  )}></span>
                                  <span className="text-[11px] sm:text-xs font-bold text-navy-800 truncate">{p.nickname || p.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {sm.goals?.[p.id] && (
                                    <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1 rounded flex items-center gap-0.5">
                                      ⚽ {sm.goals[p.id]}
                                    </span>
                                  )}
                                  {sm.assists?.[p.id] && (
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1 rounded flex items-center gap-0.5">
                                      👟 {sm.assists[p.id]}
                                    </span>
                                  )}
                                  {!sm.finished && isAdmin && (
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePlayerMenu(activePlayerMenu?.playerId === p.id ? null : { subMatchId: sm.id, playerId: p.id });
                                        }}
                                        className="p-1 text-navy-400 hover:text-navy-600 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                        </svg>
                                      </button>
                                      {activePlayerMenu?.playerId === p.id && activePlayerMenu?.subMatchId === sm.id && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setActivePlayerMenu(null)} />
                                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-navy-100 z-50 overflow-hidden py-1">
                                            <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                              <span className="text-xs font-bold text-navy-700">⚽ Gol</span>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdatePlayerGoals(sm.id, p.id, 'B', -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.goals?.[p.id] || 0}</span>
                                                <button onClick={() => handleUpdatePlayerGoals(sm.id, p.id, 'B', 1)} className="w-5 h-5 flex items-center justify-center bg-brand-50 rounded text-brand-600 hover:bg-brand-100 transition-colors">+</button>
                                              </div>
                                            </div>
                                            <div className="w-full px-3 py-1.5 flex items-center justify-between border-b border-navy-50">
                                              <span className="text-xs font-bold text-navy-700">👟 Assist.</span>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdatePlayerAssists(sm.id, p.id, -1)} className="w-5 h-5 flex items-center justify-center bg-navy-50 rounded text-navy-600 hover:bg-navy-100 transition-colors">-</button>
                                                <span className="text-[10px] font-black text-navy-900 min-w-[12px] text-center">{sm.assists?.[p.id] || 0}</span>
                                                <button onClick={() => handleUpdatePlayerAssists(sm.id, p.id, 1)} className="w-5 h-5 flex items-center justify-center bg-blue-50 rounded text-blue-600 hover:bg-blue-100 transition-colors">+</button>
                                              </div>
                                            </div>
                                            <button onClick={() => handleRemovePlayerFromSubMatch(sm.id, 'B', p.id)} className="w-full px-3 py-1.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-navy-50">❌ Remover</button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {/* Botão de adicionar extra (linha) */}
                            {!sm.finished && isAdmin && (
                              <div className="relative pt-1 border-t border-navy-50 mt-2">
                                <select
                                  onChange={(e) => {
                                    const p = players.find(pl => pl.id === e.target.value);
                                    if (p) handleAddPlayerToSubMatch(sm.id, 'B', p);
                                    e.target.value = "";
                                  }}
                                  className="w-full text-[10px] font-bold text-center bg-gray-50 border border-dashed border-gray-200 text-gray-400 p-2 sm:p-1.5 rounded-lg hover:border-brand-300 hover:text-brand-500 transition-all appearance-none cursor-pointer"
                                >
                                  <option value="">+ JOGADOR</option>
                                  {players
                                    .filter(p => (selectedMatch.arrivedPlayerIds || []).includes(p.id))
                                    .filter(p => !sm.teamA.some(tp => tp.id === p.id) && !sm.teamB.some(tp => tp.id === p.id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.nickname || p.name} ({p.position})</option>
                                    ))
                                  }
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Drag Ghost */}
        {isTouchDragging && draggingPlayer && touchDragPosition && (
          <div
            className="fixed pointer-events-none z-[9999] bg-white border-2 border-brand-500 rounded-lg p-2 shadow-2xl flex items-center gap-2"
            style={{
              left: touchDragPosition.x,
              top: touchDragPosition.y,
              transform: 'translate(-50%, -50%)',
              width: '180px'
            }}
          >
            {(() => {
              const p = players.find(pl => pl.id === draggingPlayer.playerId);
              if (!p) return null;
              return (
                <>
                  <span className={cn(
                    "w-1.5 h-6 rounded-full shrink-0",
                    p.position === Position.GOLEIRO ? 'bg-red-500' :
                      p.position === Position.DEFENSOR ? 'bg-orange-500' :
                        p.position === Position.MEIO ? 'bg-blue-500' : 'bg-green-500'
                  )}></span>
                  <span className="text-xs font-black text-navy-900 truncate">{p.nickname || p.name}</span>
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // --- DETAIL VIEW (MANAGEMENT) ---
  if (view === 'details' && selectedMatch) {
    const field = fields.find(f => f.id === selectedMatch.fieldId);
    const fieldName = field?.name || "Local desconhecido";
    const confirmedCount = selectedMatch.confirmedPlayerIds.length;
    const costPerPerson = calculateCostPerPlayer(selectedMatch);
    const totalCollected = calculateTotalCollected(selectedMatch);
    const confirmedPlayersForFinished = players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
    const filters = [
      { key: 'all', label: `Todos (${players.filter(p => !p.isGuest).length})` },
      { key: 'confirmed', label: `Confirmados (${selectedMatch.confirmedPlayerIds.length})` },
      { key: 'paid', label: `Pagos (${selectedMatch.paidPlayerIds?.length || 0})` },
      { key: 'unpaid', label: `A Pagar (${players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id) && !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber && p.position !== Position.GOLEIRO).length})` },
      { key: 'monthly', label: `Mensalistas (${players.filter(p => p.isMonthlySubscriber).length})` }
    ];

    if (!isAdmin) {
      // Simple view for non-admins
      filters.length = 0; // Clear filters or adjust as needed
    }

    const checkIsMe = (p: Player) => {
      if (p.userId === currentUser.id) return true;
      if (p.phone && currentUser.phone) {
        return p.phone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, '');
      }
      return false;
    };

    const sortedPlayersForPresence = [...players].sort((a, b) => {
      const isMeA = checkIsMe(a);
      const isMeB = checkIsMe(b);
      if (isMeA && !isMeB) return -1;
      if (!isMeA && isMeB) return 1;
      return (a.nickname || a.name).localeCompare(b.nickname || b.name);
    });

    let filteredPlayersList = sortedPlayersForPresence.filter(p => {
      if (playerFilter === 'confirmed') return selectedMatch.confirmedPlayerIds.includes(p.id);
      if (playerFilter === 'paid') return selectedMatch.paidPlayerIds?.includes(p.id);
      if (playerFilter === 'unpaid') {
        const isConfirmed = selectedMatch.confirmedPlayerIds.includes(p.id);
        const isPaid = selectedMatch.paidPlayerIds?.includes(p.id);
        const isMonthly = p.isMonthlySubscriber;
        const isGoalkeeper = p.position === Position.GOLEIRO;
        return isConfirmed && !isPaid && !isMonthly && !isGoalkeeper;
      }
      if (playerFilter === 'monthly') return p.isMonthlySubscriber;
      return true; // 'all'
    });
    if (playerFilter === 'all') {
      filteredPlayersList = filteredPlayersList.filter(p => !p.isGuest);
    }

    // Logic for finished payments display
    const filteredConfirmedPlayersForFinished = finishedPaymentsFilter === 'paid'
      ? confirmedPlayersForFinished.filter(p => selectedMatch.paidPlayerIds?.includes(p.id))
      : finishedPaymentsFilter === 'unpaid'
        ? confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id) && p.position !== Position.GOLEIRO)
        : confirmedPlayersForFinished;

    return (
      <div className="space-y-6 relative animate-fade-in">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setView('list');
            setIsFinishing(false);
            setSelectedMatch(null);
            setPlayerFilter('all');
            setSubMatches([]);
          }}
          className="flex items-center gap-1 text-navy-500 hover:text-brand-600 pl-0"
          leftIcon={<span className="text-xl">←</span>}
        >
          Voltar para lista
        </Button>

        {/* Match Header */}
        <Card className="border-l-4 border-l-brand-500 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <div className="flex justify-between items-start w-full">
                <div>
                  <h2 className="text-2xl font-bold text-navy-900 mb-1 pr-20">Jogo: {selectedMatch.date.split('-').reverse().join('/')}</h2>
                  <p className="text-brand-600 font-medium text-lg flex items-center gap-2">
                    <span>⏰ {selectedMatch.time}</span>
                    <span className="w-1.5 h-1.5 bg-navy-300 rounded-full"></span>
                    <span>📍 {fieldName}</span>
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const confirmados = players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
                    const listaJogadores = confirmados.map((p, i) => {
                      const status = (!p.isMonthlySubscriber && !selectedMatch.paidPlayerIds?.includes(p.id)) ? '❌' : '✅';
                      return `${i + 1}. ${p.nickname || p.name} ${status}`;
                    }).join('\n');

                    const textMessage = [
                      `*FUTEBOL - ${selectedMatch.date.split('-').reverse().join('/')}* ⚽`,
                      `📍 *Local:* ${fieldName}`,
                      `⏰ *Horário:* ${selectedMatch.time}`,
                      `💰 *Valor:* R$ ${costPerPerson.toFixed(2)}`,
                      '',
                      `*Confirmados (${selectedMatch.confirmedPlayerIds.length}):*`,
                      listaJogadores,
                      '',
                      `_Gerado por Futgol App_`
                    ].join('\n');

                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMessage)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors flex items-center gap-2 text-sm font-bold shadow-sm border border-brand-100"
                  title="Compartilhar Lista"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="hidden sm:inline">Compartilhar</span>
                </button>
              </div>

              {isAdmin && !selectedMatch.finished && (
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setView('queue')}
                    leftIcon={<span className="text-xl">{subMatches.length > 0 ? '🎮' : '⚽'}</span>}
                    className="flex-1 px-8 h-12 shadow-xl shadow-brand-500/20 text-md font-black"
                  >
                    {subMatches.length > 0 ? 'Entrar no Jogo' : 'Iniciar Pelada'}
                  </Button>

                  {subMatches.length > 0 && (
                    <Button
                      variant="danger"
                      onClick={() => setIsFinishing(true)}
                      leftIcon={<span className="text-xl">🛑</span>}
                      className="flex-1 px-8 h-12 shadow-xl shadow-red-500/20 text-md font-black"
                    >
                      Encerrar Partida
                    </Button>
                  )}
                </div>
              )}

              {!selectedMatch.finished && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100">
                    {activeGroup.paymentMode === 'split' && field?.hourlyRate ? (
                      <>
                        <span className="text-xs font-semibold text-brand-800">Custo Total: R$ {field.hourlyRate}</span>
                        <span className="text-brand-200">|</span>
                      </>
                    ) : null}
                    <span className="text-sm font-bold text-brand-700">R$ {costPerPerson.toFixed(2)} / pessoa</span>
                  </div>
                </div>
              )}

              {selectedMatch.finished && (
                <div className="mt-4 space-y-4">

                  <div className="flex items-center gap-3">
                    <span className="bg-navy-900 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Partida Finalizada</span>
                    {selectedMatch.mvpId && (
                      <div className="text-accent-600 font-bold flex items-center gap-1 text-sm bg-accent-50 px-2 py-0.5 rounded-full border border-accent-100">
                        🏆 Craque: {getDisplayName(players.find(p => p.id === selectedMatch.mvpId) || players[0])}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="p-4 bg-navy-50 border border-navy-100 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-navy-800 font-bold flex items-center gap-2">
                          <span>💰</span> Receber Pagamentos Avulsos
                        </p>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {[
                          { id: 'all', label: `Todos (${confirmedPlayersForFinished.length})` },
                          { id: 'paid', label: `Pagos (${(selectedMatch.paidPlayerIds || []).length})` },
                          { id: 'unpaid', label: `A Pagar (${confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber && p.position !== Position.GOLEIRO).length})` }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setFinishedPaymentsFilter(f.id as any)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                              finishedPaymentsFilter === f.id
                                ? "bg-navy-800 text-white border-navy-800"
                                : "bg-white text-navy-600 border-navy-200 hover:bg-navy-50"
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {selectedMatch.confirmedPlayerIds.length === 0 ? (
                          <div className="col-span-full text-sm text-navy-500 italic">Nenhum confirmado nesse jogo.</div>
                        ) : (
                          filteredConfirmedPlayersForFinished.map(player => {
                            const isPaid = selectedMatch.paidPlayerIds?.includes(player.id);
                            return (
                              <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-navy-100 shadow-sm">
                                <span className="text-sm font-medium text-navy-800 truncate">{getDisplayName(player)}</span>
                                {player.isMonthlySubscriber ? (
                                  <div
                                    title={isMonthlyPaid(player.id) ? 'Mensalidade paga' : 'Mensalidade pendente'}
                                    className={cn(
                                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all shadow-sm shrink-0",
                                      isMonthlyPaid(player.id)
                                        ? 'bg-green-50 text-green-700 ring-1 ring-green-300'
                                        : 'bg-red-50 text-red-600 ring-1 ring-red-200'
                                    )}
                                  >
                                    M
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant={isPaid ? "ghost" : "danger"}
                                    onClick={() => togglePayment(selectedMatch.id, player.id)}
                                    className={cn("h-7 text-xs px-2", isPaid && "text-brand-600 bg-brand-50 hover:bg-brand-100")}
                                    disabled={updatingPaymentFor === player.id}
                                    isLoading={updatingPaymentFor === player.id}
                                  >
                                    {isPaid ? 'Pago' : 'Pagar'}
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Guest Picker Modal Placeholder */}
        {isAdmin && isGuestPickerOpen && (
          <Modal isOpen={isGuestPickerOpen} onClose={() => setIsGuestPickerOpen(false)} title="Selecionar Convidado" width="sm">
            <div className="space-y-4">
              <Input
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Buscar convidado..."
                autoFocus
              />
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {guestCandidates.length === 0 && <p className="text-sm text-navy-400 text-center py-4">Nenhum convidado disponível.</p>}
                {guestCandidates
                  .filter(p => (p.nickname || p.name).toLowerCase().includes(guestSearch.toLowerCase()))
                  .map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 hover:bg-navy-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-600">
                          {p.nickname?.[0] || p.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-navy-900">{p.nickname || p.name}</p>
                          <p className="text-xs text-navy-500">{p.position}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-brand-600 hover:text-brand-700 hover:bg-brand-50" onClick={() => addExistingGuest(p.id)}>Adicionar</Button>
                    </div>
                  ))
                }
              </div>
            </div>
          </Modal>
        )}

        {/* --- ACTIVE GAME: ACTIONS --- */}
        {!selectedMatch.finished && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 -mb-2 scrollbar-hide">
              {filters.map((filter) => {
                if (!isAdmin && filter.key === 'paid') return null; // Skip paid filter for non-admin
                return (
                  <button
                    key={filter.key}
                    onClick={() => setPlayerFilter(filter.key as any)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
                      playerFilter === filter.key
                        ? "bg-navy-800 text-white border-navy-800 shadow-md transform scale-105"
                        : "bg-white text-navy-500 border-navy-100 hover:border-navy-300 hover:bg-navy-50"
                    )}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            {/* Presence List */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-navy-900">Lista de Jogadores</h3>
                  {onRefresh && (
                    <button
                      onClick={async () => {
                        if (onRefresh) {
                          const data = await onRefresh();
                          if (data?.matches && selectedMatch) {
                            const updated = data.matches.find((m: any) => m.id === selectedMatch.id);
                            if (updated) setSelectedMatch(updated);
                          }
                        }
                      }}
                      disabled={isLoading}
                      className="p-1 text-navy-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all disabled:opacity-50"
                      title="Atualizar lista"
                    >
                      <svg
                        className={cn("w-4 h-4", isLoading ? "animate-spin" : "")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {isAdmin && (
                  <Button size="sm" variant="secondary" onClick={async () => {
                    setIsLoadingGuests(true);
                    try {
                      const all = await storage.players.getAll(activeGroupId);
                      const available = all.filter(p => p.isGuest && !selectedMatch.confirmedPlayerIds.includes(p.id));
                      setGuestCandidates(available);
                      setIsGuestPickerOpen(true);
                    } finally {
                      setIsLoadingGuests(false);
                    }
                  }}>
                    + Convidado
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredPlayersList.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-navy-400">
                    Nenhum jogador encontrado neste filtro.
                  </div>
                ) : (
                  filteredPlayersList.map(player => {
                    const isConfirmed = selectedMatch.confirmedPlayerIds.includes(player.id);
                    const isMe = checkIsMe(player);
                    const canToggle = isAdmin || isMe;
                    const isPaid = selectedMatch.paidPlayerIds?.includes(player.id);

                    const positionColor =
                      player.position === Position.GOLEIRO ? 'border-l-red-500' :
                        player.position === Position.DEFENSOR ? 'border-l-orange-500' :
                          player.position === Position.MEIO ? 'border-l-blue-500' :
                            'border-l-green-500';

                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "p-3 rounded-r-xl border border-l-[6px] transition-all flex items-center justify-between group select-none",
                          isMe ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50/50" : "bg-white",
                          isConfirmed
                            ? "border-brand-200 bg-brand-50/30"
                            : "border-navy-100 hover:border-navy-300",
                          positionColor
                        )}
                      >
                        <div
                          className={cn("flex-1 flex items-center gap-3 cursor-pointer overflow-hidden",
                            (!canToggle || updatingPresenceFor === player.id) && "cursor-not-allowed opacity-70"
                          )}
                          onClick={() => canToggle && togglePresence(selectedMatch.id, player.id)}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm shrink-0",
                            isConfirmed ? "bg-brand-500 border-brand-500" : "bg-white border-navy-300"
                          )}>
                            {isConfirmed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className={cn("font-bold text-sm truncate", isConfirmed ? "text-navy-900" : "text-navy-500")}>
                                {player.nickname || player.name}
                              </span>
                              {isMe && <span className="text-[10px] uppercase font-bold text-brand-600 bg-brand-100 px-1 rounded">Eu</span>}
                            </div>
                            {player.nickname && player.nickname !== player.name && (
                              <div className="text-[10px] text-navy-400 truncate -mt-1 leading-tight mb-0.5">{player.name}</div>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              {player.isGuest && <span className="text-[10px] bg-accent-100 text-accent-800 px-1 rounded">Convidado</span>}
                              <span className={cn(
                                "text-[9px] uppercase font-bold tracking-tighter truncate px-1 rounded",
                                player.position === Position.GOLEIRO ? "bg-red-50 text-red-600" :
                                  player.position === Position.DEFENSOR ? "bg-orange-50 text-orange-600" :
                                    player.position === Position.MEIO ? "bg-blue-50 text-blue-600" :
                                      "bg-green-50 text-green-600"
                              )}>
                                {player.position}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Action (Only Admin - No Goleiros) */}
                        {/* Payment Status / Action - ONLY ADMIN */}
                        {isAdmin && (player.isMonthlySubscriber || (isConfirmed && player.position !== Position.GOLEIRO)) && (
                          <div className="ml-2 pl-2 border-l border-navy-200 shrink-0">
                            {player.isMonthlySubscriber ? (
                              <div
                                title={isMonthlyPaid(player.id) ? 'Mensalidade paga' : 'Mensalidade pendente'}
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all shadow-sm",
                                  isMonthlyPaid(player.id)
                                    ? 'bg-green-50 text-green-700 ring-1 ring-green-300'
                                    : 'bg-red-50 text-red-600 ring-1 ring-red-200'
                                )}
                              >
                                M
                              </div>
                            ) : (
                              isConfirmed && player.position !== Position.GOLEIRO && (
                                <Button
                                  size="sm"
                                  variant={isPaid ? "ghost" : "danger"}
                                  onClick={() => togglePayment(selectedMatch.id, player.id)}
                                  className={cn("h-7 text-[10px] px-2 font-bold", isPaid && "text-brand-600 hover:text-brand-700")}
                                  disabled={updatingPaymentFor === player.id}
                                  isLoading={updatingPaymentFor === player.id}
                                >
                                  {isPaid ? 'Pago' : 'Pagar'}
                                </Button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-navy-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <p className="text-sm text-navy-500 italic hidden md:block">
                  {isAdmin
                    ? "Gerencie a presença e os pagamentos dos jogadores."
                    : "Confirme sua presença para jogar."}
                </p>
              </div>
            </Card>

            {/* Teams Display */}
          </>
        )}

        {/* Finished Match History */}
        {selectedMatch.finished && selectedMatch.subMatches && selectedMatch.subMatches.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-xl font-black text-navy-900 flex items-center gap-2 mb-6">
              <span className="bg-brand-100 p-1.5 rounded-lg text-lg">📊</span> Histórico de Jogos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedMatch.subMatches.map((sm) => (
                <Card key={sm.id} className="p-0 overflow-hidden border-none shadow-xl shadow-navy-900/5 bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all duration-300">
                  <div className="bg-gradient-to-r from-navy-800 to-navy-900 p-3 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-navy-300 text-[10px] font-black uppercase tracking-widest">{sm.name}</span>
                      <span className="text-white text-xs font-bold">Resumo da Partida</span>
                    </div>
                    <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-xl px-4 py-1.5 border border-white/10">
                      <span className="text-white font-black text-xl leading-none">{sm.scoreA}</span>
                      <span className="text-navy-400 font-black text-xs uppercase">vs</span>
                      <span className="text-white font-black text-xl leading-none">{sm.scoreB}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2">
                    {/* Time A */}
                    <div className="p-4 bg-brand-50/30">
                      <div className="flex items-center gap-2 mb-3 border-b border-brand-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                        <h5 className="text-[11px] font-black text-brand-700 uppercase tracking-widest">Time A</h5>
                      </div>
                      <div className="space-y-2">
                        {sm.teamA.map(p => {
                          const goals = sm.goals?.[p.id] || 0;
                          const assists = sm.assists?.[p.id] || 0;
                          return (
                            <div key={p.id} className="flex flex-col">
                              <span className="text-sm font-bold text-navy-800 truncate">
                                {p.nickname || p.name}
                              </span>
                              {(goals > 0 || assists > 0) && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {goals > 0 && (
                                    <span className="text-[10px] flex items-center gap-0.5 text-navy-500 font-bold bg-white px-1.5 py-0.5 rounded border border-navy-100">
                                      ⚽ {goals}
                                    </span>
                                  )}
                                  {assists > 0 && (
                                    <span className="text-[10px] flex items-center gap-0.5 text-navy-500 font-bold bg-white px-1.5 py-0.5 rounded border border-navy-100">
                                      👟 {assists}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time B */}
                    <div className="p-4 bg-red-50/30">
                      <div className="flex items-center gap-2 mb-3 border-b border-red-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <h5 className="text-[11px] font-black text-red-700 uppercase tracking-widest">Time B</h5>
                      </div>
                      <div className="space-y-2">
                        {sm.teamB.map(p => {
                          const goals = sm.goals?.[p.id] || 0;
                          const assists = sm.assists?.[p.id] || 0;
                          return (
                            <div key={p.id} className="flex flex-col">
                              <span className="text-sm font-bold text-navy-800 truncate text-right">
                                {p.nickname || p.name}
                              </span>
                              {(goals > 0 || assists > 0) && (
                                <div className="flex items-center gap-2 mt-0.5 justify-end">
                                  {assists > 0 && (
                                    <span className="text-[10px] flex items-center gap-0.5 text-navy-500 font-bold bg-white px-1.5 py-0.5 rounded border border-navy-100">
                                      👟 {assists}
                                    </span>
                                  )}
                                  {goals > 0 && (
                                    <span className="text-[10px] flex items-center gap-0.5 text-navy-500 font-bold bg-white px-1.5 py-0.5 rounded border border-navy-100">
                                      ⚽ {goals}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-navy-800">Comentários</h3>
            <button onClick={loadComments} className="text-xs text-brand-600 font-bold hover:underline">Atualizar Comentários</button>
          </div>
          <Card className="p-4 bg-navy-50/50 border-navy-100 shadow-inner">
            <div className="flex gap-3 mb-6">
              <Input
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escreva um comentário..."
                className="bg-white"
                onKeyDown={(e) => e.key === 'Enter' && submitNewComment()}
              />
              <Button onClick={submitNewComment} disabled={!newCommentText.trim()} className="shrink-0">
                Enviar
              </Button>
            </div>

            {isCommentsLoading ? (
              <div className="text-center py-8 text-navy-400">Carregando conversas...</div>
            ) : (
              <div className="space-y-4">
                {comments.filter(c => !c.parentId).map(c => {
                  const author = players.find(p => p.id === c.authorPlayerId);
                  const replies = comments.filter(r => r.parentId === c.id);
                  const isMine = c.authorPlayerId === (currentPlayer?.id || currentUser.id);
                  return (
                    <div key={c.id} className="group">
                      <div className={cn("p-3 rounded-2xl relative", isMine ? "bg-brand-50 rounded-tr-none ml-8" : "bg-white rounded-tl-none mr-8 shadow-sm")}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-bold", isMine ? "text-brand-700" : "text-navy-700")}>
                            {author ? (author.nickname || author.name) : 'Jogador'}
                          </span>
                          <span className="text-[10px] text-navy-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm text-navy-800 leading-relaxed">{c.content}</p>

                        <div className="flex gap-3 mt-2">
                          <button onClick={() => setReplyOpenMap(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-[10px] font-bold text-navy-400 hover:text-brand-600 transition-colors">Responder</button>
                          {currentPlayer?.id === c.authorPlayerId && (
                            <button onClick={() => requestDeleteComment(c.id)} className="text-[10px] font-bold text-red-300 hover:text-red-500 transition-colors">Excluir</button>
                          )}
                        </div>
                      </div>

                      {/* Replies */}
                      {replies.length > 0 && (
                        <div className="mt-2 pl-4 space-y-2 border-l-2 border-navy-100 ml-4">
                          {replies.map(r => {
                            const rauthor = players.find(p => p.id === r.authorPlayerId);
                            return (
                              <div key={r.id} className="bg-white/80 p-2 rounded-lg text-sm">
                                <div className="flex justify-between">
                                  <span className="font-bold text-xs text-navy-700">{rauthor ? (rauthor.nickname || rauthor.name) : 'Jogador'}</span>
                                  {currentPlayer?.id === r.authorPlayerId && (
                                    <button onClick={() => requestDeleteComment(r.id)} className="text-[10px] text-red-300 hover:text-red-500">✕</button>
                                  )}
                                </div>
                                <p className="text-navy-600 mt-1">{r.content}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {replyOpenMap[c.id] && (
                        <div className="mt-2 ml-8 flex gap-2 animate-fade-in-up">
                          <Input
                            value={replyTextMap[c.id] || ''}
                            onChange={(e) => setReplyTextMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                            placeholder="Responder..."
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && submitReply(c.id)}
                          />
                          <Button size="sm" onClick={() => submitReply(c.id)} disabled={!((replyTextMap[c.id] || '').trim())}>→</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {comments.filter(c => !c.parentId).length === 0 && (
                  <div className="text-center py-8 text-navy-300 italic">Nenhuma conversa iniciada.</div>
                )}
              </div>
            )}
          </Card>
        </div>
        <Modal isOpen={isFinishing} onClose={() => setIsFinishing(false)} title="Encerrar Partida">
          <div className="space-y-6">
            <p className="text-navy-600">
              Tem certeza que deseja encerrar a pelada de hoje?
              <br />
              <span className="text-sm text-navy-400 mt-2 block">Isso finalizará o evento e não permitirá mais sorteios ou alterações de presença.</span>
            </p>

            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsFinishing(false)} className="flex-1">Voltar</Button>
              <Button variant="danger" onClick={handleFinishMatch} className="flex-1" isLoading={isSaving} disabled={isSaving}>Sim, Encerrar</Button>
            </div>
          </div>
        </Modal>

        {/* Match Delete Confirmation */}
        <Modal isOpen={!!matchToDelete} onClose={() => setMatchToDelete(null)} title="Excluir Jogo">
          <p className="text-navy-600 mb-6">
            Tem certeza que deseja apagar este jogo?
            <br />
            <span className="text-sm text-red-500 font-bold mt-2 block">Isso removerá também todos os pagamentos e estatísticas associados.</span>
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setMatchToDelete(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Excluir Jogo</Button>
          </div>
        </Modal>

        {/* Comment Delete Confirmation */}
        <Modal isOpen={!!deleteCommentId} onClose={cancelDeleteComment} title="Excluir Comentário">
          <p className="text-navy-600 mb-6">Tem certeza que deseja apagar esta mensagem? Não será possível desfazer.</p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancelDeleteComment} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={confirmDeleteComment} className="flex-1">Excluir</Button>
          </div>
        </Modal>

      </div >
    );
  }

  // --- LIST VIEW ---

  return (
    <div className="space-y-6 relative animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex items-center gap-4 mb-2">
          <h3 className="font-heading font-bold text-navy-800 text-xl">Jogos</h3>
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-navy-50 border border-navy-100 rounded-xl px-3 py-1.5 text-sm font-bold text-navy-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none cursor-pointer hover:bg-white"
            />
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openNewMatchModal} leftIcon={<span className="text-lg">+</span>}>
            Agendar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
        {(matches
          .filter(m => m.date.startsWith(selectedMonth))
          .sort((a, b) => {
            const aFinished = !!a.finished;
            const bFinished = !!b.finished;
            if (aFinished !== bFinished) return aFinished ? 1 : -1;
            const aDate = new Date(`${a.date}T${a.time || '00:00'}`);
            const bDate = new Date(`${b.date}T${b.time || '00:00'}`);
            if (!aFinished && !bFinished) return aDate.getTime() - bDate.getTime();
            return bDate.getTime() - aDate.getTime();
          })).map(match => {
            const field = fields.find(f => f.id === match.fieldId);
            const fieldName = field?.name || "Local desconhecido";
            const isFinished = match.finished;
            const dateObj = new Date(`${match.date}T${match.time}`);
            const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit' });
            const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });

            return (
              <Card
                key={match.id}
                hoverEffect
                className={cn(
                  "relative overflow-hidden cursor-pointer group border-l-8",
                  isFinished ? "border-l-navy-300 opacity-90" : "border-l-brand-500"
                )}
                onClick={() => { setSelectedMatch(match); setView('details'); }}
              >
                <div className="flex items-start gap-5">
                  <div className={cn(
                    "flex flex-col items-center justify-center w-16 h-16 rounded-xl border shadow-sm shrink-0",
                    isFinished ? "bg-navy-50 border-navy-200 text-navy-400" : "bg-brand-50 border-brand-200 text-brand-700"
                  )}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{month}</span>
                    <span className="text-2xl font-bold leading-none -mt-0.5">{day}</span>
                    <span className="text-[10px] uppercase font-bold text-navy-400">{weekday}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className={cn("font-bold truncate text-lg", isFinished ? "text-navy-500" : "text-navy-900")}>
                        {fieldName}
                      </h3>
                    </div>

                    <p className={cn("text-sm font-medium flex items-center gap-1", isFinished ? "text-navy-400" : "text-brand-600")}>
                      ⏰ {match.time}
                    </p>

                    {isFinished ? (
                      <div className="space-y-3">
                        <MatchVoteCard
                          match={match}
                          currentUser={currentUser}
                          currentPlayer={currentPlayer}
                          players={players}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {[...Array(Math.min(3, match.confirmedPlayerIds.length))].map((_, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-navy-100 border-2 border-white"></div>
                          ))}
                          {match.confirmedPlayerIds.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-navy-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-navy-500">
                              +{match.confirmedPlayerIds.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-navy-500">
                          {match.confirmedPlayerIds.length} confirmados
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Quick Actions */}
                {
                  !isFinished && isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditMatch(match); }}
                        className="p-1.5 bg-white rounded-lg shadow-sm border border-navy-100 text-navy-400 hover:text-brand-600 hover:border-brand-200 transition-all"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMatchToDelete(match.id); }}
                        className="p-1.5 bg-white rounded-lg shadow-sm border border-navy-100 text-navy-400 hover:text-red-600 hover:border-red-200 transition-all"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )
                }
              </Card>
            );
          })}
        {matches.filter(m => m.date.startsWith(selectedMonth)).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-navy-400 border-2 border-dashed border-navy-100 rounded-3xl bg-navy-50/50">
            <div className="text-4xl mb-3 opacity-50">📅</div>
            <p className="text-lg font-medium text-navy-600">Nenhum jogo para este mês.</p>
            {isAdmin ? (
              <p className="text-sm">Clique em "Agendar" para começar o mês com o pé direito!</p>
            ) : (
              <p className="text-sm">Aguarde o administrador agendar os próximos jogos.</p>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      {
        isAdmin && (
          <button
            onClick={openNewMatchModal}
            className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center z-40 active:scale-90 transition-transform"
          >
            <span className="text-3xl font-light mb-1">+</span>
          </button>
        )
      }

      {/* Modal: Create/Edit Match */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingMatchId ? 'Editar Partida' : 'Agendar Jogo'}
      >
        <form onSubmit={handleCreateOrUpdateMatch} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1">Data</label>
            <DateInput
              value={date}
              onChange={setDate}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
            />
          </div>
          <Input
            label="Horário"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1">Local</label>
            <select
              required
              value={fieldId}
              onChange={e => setFieldId(e.target.value)}
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
            >
              <option value="">Selecione um campo...</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name} - R${f.hourlyRate}/h</option>)}
            </select>
            {fields.length === 0 && <p className="text-xs text-red-500 mt-1 font-medium">Cadastre um campo primeiro.</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isSaving}
            >
              {editingMatchId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!matchToDelete} onClose={() => setMatchToDelete(null)} title="Excluir jogo">
        <p className="text-navy-600 mb-6">Tem certeza que deseja cancelar este jogo? Esta ação não poderá ser desfeita.</p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setMatchToDelete(null)} className="flex-1">
            Manter Jogo
          </Button>
          <Button variant="danger" onClick={confirmDelete} className="flex-1">
            Sim, Cancelar
          </Button>
        </div>
      </Modal>
    </div >
  );
};
