
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
  const [view, setView] = useState<'list' | 'details' | 'queue'>(() => {
    try {
      const saved = localStorage.getItem(`FUTGOL_VIEW_${activeGroupId}`);
      return (saved as any) || 'list';
    } catch { return 'list'; }
  });

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(() => {
    try {
      const savedId = localStorage.getItem(`FUTGOL_MATCH_ID_${activeGroupId}`);
      if (savedId && matches) {
        return matches.find(m => m.id === savedId) || null;
      }
    } catch { }
    return null;
  });

  // Estados de Filtro (Lista de Presença e Pagamentos)
  const [playerFilter, setPlayerFilter] = useState<'all' | 'confirmed' | 'paid' | 'unpaid' | 'monthly' | 'guests'>('all');
  const [finishedPaymentsFilter, setFinishedPaymentsFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Controle de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado do Formulário (Agendamento)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [fieldId, setFieldId] = useState('');

  // Estados de Finalização de Jogo (Placar, MVP)
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Estados de proteção contra cliques duplos (pagamento e presença)
  const [updatingPaymentFor, setUpdatingPaymentFor] = useState<string | null>(null);
  const [updatingPresenceFor, setUpdatingPresenceFor] = useState<string | null>(null);
  const [updatingArrivalFor, setUpdatingArrivalFor] = useState<string | null>(null);

  // Equilíbrio de Times com Inteligência Artificial
  const [isBalancing, setIsBalancing] = useState(false);
  const [outfieldPlayers, setOutfieldPlayers] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`FUTGOL_OUTFIELD_${activeGroupId}`);
      return saved ? parseInt(saved, 10) : 6;
    } catch { return 6; }
  });
  const [subMatches, setSubMatches] = useState<SubMatch[]>([]);
  const [draggingPlayer, setDraggingPlayer] = useState<{ playerId: string, subMatchId: string, fromTeam: 'A' | 'B' } | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<{ subMatchId: string, team: 'A' | 'B' } | null>(null);
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number, y: number } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const arenaRef = React.useRef<HTMLDivElement>(null);
  const [activeSubMatchMenuId, setActiveSubMatchMenuId] = useState<string | null>(null);
  const [activePlayerMenu, setActivePlayerMenu] = useState<{ subMatchId: string, playerId: string } | null>(null);
  const [subMatchToFinish, setSubMatchToFinish] = useState<string | null>(null);
  const [subMatchToCancel, setSubMatchToCancel] = useState<string | null>(null);
  const [subMatchToReactivate, setSubMatchToReactivate] = useState<string | null>(null);
  const [teamToClear, setTeamToClear] = useState<{ subMatchId: string, team: 'A' | 'B' } | null>(null);

  // Confirmação de Exclusão e Busca de Convidados
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestCandidates, setGuestCandidates] = useState<Player[]>([]);

  // Gestão Financeira de Mensalistas
  const [monthlyTxMap, setMonthlyTxMap] = useState<Record<string, string>>({});
  const [monthlyAggregateId, setMonthlyAggregateId] = useState<string | null>(null);

  // Sistema de Comentários e Respostas
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyOpenMap, setReplyOpenMap] = useState<Record<string, boolean>>({});
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isPlayerListCollapsed, setIsPlayerListCollapsed] = useState(true);


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

  // Filtro de Posições que não jogam (Staff)
  const STAFF_POSITIONS = ['auxiliar', 'mesário', 'juiz', 'juíz', 'organizador', 'técnico', 'tecnico'];
  const playablePlayers = players.filter(p => !STAFF_POSITIONS.includes((p.position || '').toLowerCase()));

  // Sincroniza o status de pagamento mensal dos jogadores do grupo
  const loadMonthlyStatus = async () => {
    try {
      if (!selectedMatch) return;
      const txs = await storage.transactions.getAll(activeGroupId);
      const m = selectedMatch.date.slice(0, 7);
      const map: Record<string, string> = {};

      txs.forEach(t => {
        if (t.category === 'MONTHLY_FEE' && (t.date || '').slice(0, 7) === m) {
          if (t.relatedPlayerId) {
            map[t.relatedPlayerId] = t.id;
          }
          if (t.paidPlayerIds && Array.isArray(t.paidPlayerIds)) {
            t.paidPlayerIds.forEach(pid => {
              map[pid] = t.id;
            });
          }
        }
      });
      setMonthlyTxMap(map);
      const aggregate = txs.find(t => t.category === 'MONTHLY_FEE' && !t.relatedPlayerId && (t.date || '').slice(0, 7) === m && (t.description || '').toLowerCase().includes('mensalistas'));
      setMonthlyAggregateId(aggregate ? aggregate.id : null);
    } catch {
      setMonthlyTxMap({});
      setMonthlyAggregateId(null);
    }
  };

  const genSafeId = (prefix: string = 'id') => {
    const c: any = (window as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${prefix}_` + Math.random().toString(36).slice(2) + Date.now().toString(36);
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
      localStorage.setItem(`FUTGOL_MATCH_ID_${activeGroupId}`, selectedMatch.id);
      localStorage.setItem(`FUTGOL_VIEW_${activeGroupId}`, view);
    } else {
      setSubMatches([]);
      if (view === 'list' && !isLoading) {
        localStorage.removeItem(`FUTGOL_MATCH_ID_${activeGroupId}`);
        localStorage.setItem(`FUTGOL_VIEW_${activeGroupId}`, 'list');
      }
    }
  }, [selectedMatch, view, activeGroupId, isLoading]);

  useEffect(() => {
    localStorage.setItem(`FUTGOL_OUTFIELD_${activeGroupId}`, outfieldPlayers.toString());
  }, [outfieldPlayers, activeGroupId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activePlayerMenu) setActivePlayerMenu(null);
    };
    if (activePlayerMenu) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activePlayerMenu]);

  useEffect(() => {
    if (selectedMatch) {
      setIsPlayerListCollapsed(selectedMatch.finished);
    }
  }, [selectedMatch?.id]);

  useEffect(() => {
    const savedId = localStorage.getItem(`FUTGOL_MATCH_ID_${activeGroupId}`);
    if (savedId && matches) {
      const updated = matches.find(m => m.id === savedId);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedMatch)) {
        setSelectedMatch(updated);
      }
    }
  }, [matches, activeGroupId]);

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
    if (!canToggle || isSaving) return;
    if (updatingPresenceFor === playerId) return;

    try {
      setIsSaving(true);
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
      setIsSaving(false);
    }
  };

  const toggleArrival = async (matchId: string, playerId: string) => {
    if (!selectedMatch || !isAdmin || isSaving) return;
    if (updatingArrivalFor === playerId) return;

    try {
      setIsSaving(true);
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
      setIsSaving(false);
    }
  };

  const togglePayment = async (matchId: string, playerId: string) => {
    if (!isAdmin || isSaving) return;
    if (updatingPaymentFor === playerId) return;

    try {
      setIsSaving(true);
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

      const confirmedCount = updatedMatch.confirmedPlayerIds.length;
      const costPerPersonSync = calculateCostPerPlayer(updatedMatch);

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
      setIsSaving(false);
    }
  };

  const addExistingGuest = async (playerId: string) => {
    if (!isAdmin || isSaving) return;
    if (!selectedMatch) return;
    if (selectedMatch.confirmedPlayerIds.includes(playerId)) {
      setIsGuestPickerOpen(false);
      return;
    }
    try {
      setIsSaving(true);
      const updated: Match = {
        ...selectedMatch,
        confirmedPlayerIds: [...selectedMatch.confirmedPlayerIds, playerId]
      };
      await onSave(updated);
      setSelectedMatch(updated);
      setIsGuestPickerOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateTeams = async (match: Match | null) => {
    if (!isAdmin || isBalancing || isSaving || !match) return;

    const totalNeeded = outfieldPlayers * 2;
    const currentArrivedIds = match?.arrivedPlayerIds || [];

    const arrivedOutfielderIds = currentArrivedIds.filter(id => {
      const p = playablePlayers.find(player => player.id === id);
      return p && p.position !== Position.GOLEIRO;
    });

    if (subMatches.length > 0 && arrivedOutfielderIds.length < totalNeeded) {
      alert(`Para ${outfieldPlayers} de linha, você precisa de pelo menos ${totalNeeded} jogadores de linha presentes.`);
      return;
    }

    setIsBalancing(true);
    setIsSaving(true);

    try {
      let tA: Player[] = [];
      let tB: Player[] = [];

      if (subMatches.length === 0) {
        tA = [];
        tB = [];
      } else {
        const lastSM = subMatches[subMatches.length - 1];
        const prevSM = subMatches.length > 1 ? subMatches[subMatches.length - 2] : null;

        let stayingPlayers: Player[] = [];
        let incomingFromLast: Player[] = [];

        if (!prevSM) {
          if (lastSM.scoreB > lastSM.scoreA) {
            stayingPlayers = lastSM.teamB;
            incomingFromLast = lastSM.teamB;
          } else {
            stayingPlayers = lastSM.teamA;
            incomingFromLast = lastSM.teamB;
          }
        } else {
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
            stayingPlayers = (lastSM.scoreB > lastSM.scoreA) ? lastSM.teamB : lastSM.teamA;
            incomingFromLast = stayingPlayers;
          }
        }

        tA = stayingPlayers;
        const lastInQueue = arrivedOutfielderIds.reduce((maxIdx, id) => {
          if (incomingFromLast.some(p => p.id === id)) {
            const idx = arrivedOutfielderIds.indexOf(id);
            return Math.max(maxIdx, idx);
          }
          return maxIdx;
        }, -1);

        const teamBIds: string[] = [];
        let cursor = (lastInQueue + 1) % arrivedOutfielderIds.length;
        let attempts = 0;

        while (teamBIds.length < outfieldPlayers && attempts < arrivedOutfielderIds.length) {
          const pid = arrivedOutfielderIds[cursor];
          if (!tA.some(p => p.id === pid)) {
            teamBIds.push(pid);
          }
          cursor = (cursor + 1) % arrivedOutfielderIds.length;
          attempts++;
        }

        tB = playablePlayers.filter(p => teamBIds.includes(p.id))
          .sort((a, b) => teamBIds.indexOf(a.id) - teamBIds.indexOf(b.id));
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
      const updatedMatch = { ...match, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);

      setTimeout(() => {
        arenaRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
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
    await onSave({ ...selectedMatch, subMatches: newSubMatches });
  };

  const handleFinishSubMatch = async (subMatchId: string) => {
    if (!selectedMatch) return;
    try {
      const newSubMatches = subMatches.map(sm =>
        sm.id === subMatchId ? { ...sm, finished: true } : sm
      );
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error(err);
    } finally {
      setActiveSubMatchMenuId(null);
      setSubMatchToFinish(null);
    }
  };

  const handleCancelSubMatch = async (subMatchId: string) => {
    if (!selectedMatch) return;
    try {
      const newSubMatches = subMatches.filter(sm => sm.id !== subMatchId);
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error(err);
    } finally {
      setActiveSubMatchMenuId(null);
      setSubMatchToCancel(null);
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
      console.error(err);
    } finally {
      setActiveSubMatchMenuId(null);
      setSubMatchToReactivate(null);
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
    if (!selectedMatch) return;
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

  const handleClearTeam = async (subMatchId: string, team: 'A' | 'B') => {
    if (!selectedMatch) return;
    try {
      const newSubMatches = subMatches.map(sm => {
        if (sm.id !== subMatchId) return sm;
        const playersToRemove = team === 'A' ? sm.teamA : sm.teamB;
        const playerIdsToRemove = playersToRemove.map(p => p.id);
        const newGoals = { ...(sm.goals || {}) };
        const newAssists = { ...(sm.assists || {}) };
        playerIdsToRemove.forEach(pid => {
          delete newGoals[pid];
          delete newAssists[pid];
        });
        return {
          ...sm,
          teamA: team === 'A' ? [] : sm.teamA,
          teamB: team === 'B' ? [] : sm.teamB,
          scoreA: team === 'A' ? 0 : sm.scoreA,
          scoreB: team === 'B' ? 0 : sm.scoreB,
          goals: newGoals,
          assists: newAssists
        };
      });
      setSubMatches(newSubMatches);
      const updatedMatch = { ...selectedMatch, subMatches: newSubMatches };
      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
    } catch (err) {
      console.error(err);
    } finally {
      setTeamToClear(null);
    }
  };

  const handleAddPlayerToSubMatch = async (subMatchId: string, team: 'A' | 'B', player: Player) => {
    if (!selectedMatch) return;
    const targetSM = subMatches.find(sm => sm.id === subMatchId);
    if (targetSM) {
      const currentTeam = team === 'A' ? targetSM.teamA : targetSM.teamB;
      if (player.position !== Position.GOLEIRO) {
        const linePlayers = currentTeam.filter(p => p.position !== Position.GOLEIRO);
        if (linePlayers.length >= outfieldPlayers) return;
      } else {
        const hasGoleiro = currentTeam.some(p => p.position === Position.GOLEIRO);
        if (hasGoleiro) return;
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

    let blocked = false;
    const newSubMatches = subMatches.map(sm => {
      if (sm.id !== subMatchId) return sm;
      const player = (draggingPlayer.fromTeam === 'A' ? sm.teamA : sm.teamB).find(p => p.id === draggingPlayer.playerId);
      if (!player) return sm;
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
      const newTeamA = draggingPlayer.fromTeam === 'A' ? sm.teamA.filter(p => p.id !== draggingPlayer.playerId) : [...sm.teamA, player];
      const newTeamB = draggingPlayer.fromTeam === 'B' ? sm.teamB.filter(p => p.id !== draggingPlayer.playerId) : [...sm.teamB, player];
      return { ...sm, teamA: newTeamA, teamB: newTeamB };
    });

    if (blocked) {
      setDraggingPlayer(null);
      return;
    }

    setSubMatches(newSubMatches);
    if (selectedMatch) {
      await onSave({ ...selectedMatch, subMatches: newSubMatches });
    }
    setDraggingPlayer(null);
  };

  const handleFinishMatch = async () => {
    if (!selectedMatch || !isAdmin || isSaving) return;
    const updatedMatch = { ...selectedMatch, finished: true };
    try {
      setIsSaving(true);
      await onSave(updatedMatch);
      const field = fields.find(f => f.id === selectedMatch.fieldId);
      if (field) {
        const fieldExpense = {
          id: genSafeId('expense'),
          groupId: activeGroupId,
          description: `Pagamento de Campo/Quadra : ${field.name}`,
          amount: field.hourlyRate,
          type: 'EXPENSE' as const,
          category: 'FIELD_RENT' as const,
          date: selectedMatch.date,
          relatedMatchId: selectedMatch.id
        };
        await storage.transactions.save(fieldExpense as any);
      }
      const nonMonthlyPaidCount = players.filter(p => (selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber).length;
      const costPerPerson = calculateCostPerPlayer(selectedMatch);
      if (field && nonMonthlyPaidCount > 0) {
        const totalIncome = nonMonthlyPaidCount * costPerPerson;
        await storage.transactions.upsertMatchTransaction(activeGroupId, selectedMatch.id, totalIncome, `Jogadores Avulso : ${field.name}`, selectedMatch.date);
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
    return field.hourlyRate / (match.confirmedPlayerIds.length || 1);
  };

  const calculateTotalCollected = (match: Match) => {
    const costPerPerson = calculateCostPerPlayer(match);
    return (match.paidPlayerIds?.length || 0) * costPerPerson;
  };

  const checkIsMe = (p: Player) => p.userId === currentUser.id;

  // Render Queue (Arena) View
  if (view === 'queue' && selectedMatch) {
    const confirmedPlayers = playablePlayers.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
    const arrivedIds = selectedMatch.arrivedPlayerIds || [];
    const waitingPlayers = confirmedPlayers.filter(p => !arrivedIds.includes(p.id)).sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));
    const arrivedPlayers = arrivedIds.map(id => confirmedPlayers.find(p => p.id === id)).filter((p): p is Player => !!p);

    return (
      <div className="space-y-6 animate-fade-in relative mb-10">
        <Button variant="brand" size="sm" onClick={() => setView('details')} className="flex items-center gap-1 text-black pl-3 pr-4" leftIcon={<span>←</span>}>Voltar</Button>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar: Presentes (Top on Mobile, Left on Desktop) */}
          <div className="lg:col-span-4 lg:order-1 lg:sticky lg:top-24">
            <Card className="p-6 shadow-2xl border-1 border-navy-900 bg-gray-200">
              <h4 className="text-xl font-black mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                Lista de Presentes ({arrivedPlayers.length})
              </h4>
              <div className="space-y-3 max-h-[30vh] lg:max-h-[75vh] overflow-y-auto pr-2 scrollbar-premium">
                {arrivedPlayers.map((p, idx) => {
                  const isPlaying = subMatches.some(sm => !sm.finished && (sm.teamA.some(tp => tp.id === p.id) || sm.teamB.some(tp => tp.id === p.id)));
                  return (
                    <div key={p.id} onClick={() => isAdmin && !isPlaying && toggleArrival(selectedMatch.id, p.id)} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all shadow-sm", isPlaying ? "opacity-40 grayscale" : "bg-white cursor-pointer hover:border-navy-900")}>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-black text-navy-400 w-4">{idx + 1}º</span>
                        <span className={cn("w-1 h-6 rounded-full", p.position === Position.GOLEIRO ? "bg-red-500" : p.position === Position.DEFENSOR ? "bg-orange-500" : p.position === Position.MEIO ? "bg-blue-500" : "bg-green-500")} />
                        <span className="font-bold text-sm text-navy-900">{p.nickname || p.name}</span>
                      </div>
                      {isPlaying && <span className="text-[8px] bg-navy-900 text-white px-2 py-0.5 rounded-full">JOGANDO</span>}
                    </div>
                  );
                })}
                {arrivedPlayers.length === 0 && (
                  <p className="text-center py-8 text-navy-400 text-xs italic">Nenhum atleta presente ainda.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Main Area: Arena (Bottom on Mobile, Right on Desktop) */}
          <div className="lg:col-span-8 lg:order-2 space-y-8">
            <header><h3 className="text-4xl font-black text-navy-900 mb-2">Arena Futgol <span className="text-sm bg-brand-500 text-white px-3 py-1 rounded-full align-middle ml-2">LIVE</span></h3></header>

            {waitingPlayers.length > 0 && (
              <Card className="p-5 bg-navy-50/50 border-navy-100">
                <h4 className="text-[10px] font-black text-navy-400 uppercase mb-4 tracking-widest">Check-in Pendente ({waitingPlayers.length})</h4>
                <div className="flex flex-wrap gap-2.5">
                  {waitingPlayers.map(p => (
                    <button key={p.id} onClick={() => isAdmin && toggleArrival(selectedMatch.id, p.id)} className="px-4 py-2 rounded-xl border-2 border-navy-200 font-black text-xs bg-white hover:border-brand-500 transition-all">{p.nickname || p.name}</button>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-2 bg-white rounded-2xl border-2 border-navy-100 shadow-sm">
                <div className="flex flex-col"><span className="text-[10px] font-black text-navy-400 uppercase tracking-tighter">Formato</span><span className="text-sm font-bold text-navy-900">{outfieldPlayers} x {outfieldPlayers} + Goleiro</span></div>
                <select value={outfieldPlayers} onChange={(e) => setOutfieldPlayers(Number(e.target.value))} className="bg-navy-50 rounded-xl px-3 py-2 font-black text-navy-900 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer">{[4, 5, 6, 7, 8, 9, 10].map(n => (<option key={n} value={n}>{n}x{n}</option>))}</select>
              </div>
              <Button className="h-16 rounded-2xl font-black text-xl shadow-xl shadow-brand-500/10" onClick={() => handleGenerateTeams(selectedMatch)} isLoading={isBalancing} disabled={arrivedPlayers.length < 2}>PRÓXIMO JOGO</Button>
            </div>

            {subMatches.length > 0 && (
              <div ref={arenaRef} className="space-y-6">
                {subMatches.slice().reverse().map((sm) => (
                  <Card key={sm.id} className={cn("p-0 border-2", sm.finished ? "opacity-70 grayscale-[0.5]" : "shadow-xl border-navy-200")}>
                    <div className={cn("p-4 flex justify-between items-center text-white rounded-t-2xl", sm.finished ? "bg-navy-700" : "bg-green-900")}>
                      <span className="font-black uppercase tracking-widest text-xs">{sm.name}</span>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button onClick={() => sm.finished ? setSubMatchToReactivate(sm.id) : setSubMatchToFinish(sm.id)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">{sm.finished ? '🔄' : '🏁'}</button>
                          <button onClick={() => setSubMatchToCancel(sm.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">🗑️</button>
                        </div>
                      )}
                    </div>
                    <div className="relative p-8">
                      <div className="absolute left-1/2 top-0.5 -translate-x-1/2 flex items-center bg-navy-900 text-white rounded-full h-12 px-6 border-2 border-navy-700 shadow-2xl z-20">
                        <input type="number" className="w-10 bg-transparent text-center font-black text-xl outline-none" value={sm.scoreA} onChange={(e) => handleUpdateSubMatchScore(sm.id, 'A', Number(e.target.value))} disabled={sm.finished || !isAdmin} />
                        <span className="px-3 opacity-30 font-black">X</span>
                        <input type="number" className="w-10 bg-transparent text-center font-black text-xl outline-none" value={sm.scoreB} onChange={(e) => handleUpdateSubMatchScore(sm.id, 'B', Number(e.target.value))} disabled={sm.finished || !isAdmin} />
                      </div>
                      <div className="grid grid-cols-2 divide-x-2 divide-navy-50">
                        {[sm.teamA, sm.teamB].map((team, idx) => (
                          <div key={idx} className="p-4 flex flex-col pt-8" onDragOver={(e) => handleDragOver(e, sm.id, idx === 0 ? 'A' : 'B')} onDrop={() => handleDrop(sm.id, idx === 0 ? 'A' : 'B')}>
                            <div className="flex items-center justify-between mb-6">
                              <h5 className={cn("text-[10px] font-black uppercase tracking-widest", idx === 0 ? "text-brand-500" : "text-red-500")}>Time {idx === 0 ? 'A' : 'B'}</h5>
                              {isAdmin && !sm.finished && team.length > 0 && (
                                <button onClick={() => setTeamToClear({ subMatchId: sm.id, team: idx === 0 ? 'A' : 'B' })} className="text-[12px] font-black text-navy-400 hover:text-red-500 transition-colors uppercase">Limpar</button>
                              )}
                            </div>
                            <div className="space-y-2 w-full min-h-[100px]">
                              {team.map(p => (
                                <div key={p.id} className={cn(
                                  "group relative flex items-center justify-between bg-white p-3 rounded-xl border border-navy-50 shadow-sm",
                                  activePlayerMenu?.playerId === p.id && activePlayerMenu?.subMatchId === sm.id ? "z-50 border-brand-500 shadow-xl" : "z-0"
                                )} draggable={isAdmin && !sm.finished} onDragStart={() => handleDragStart(p.id, sm.id, idx === 0 ? 'A' : 'B')}>
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={cn(
                                      "w-1 h-4 rounded-full flex-shrink-0",
                                      p.position === Position.GOLEIRO ? "bg-red-500" :
                                        p.position === Position.DEFENSOR ? "bg-orange-500" :
                                          p.position === Position.MEIO ? "bg-blue-500" :
                                            "bg-green-500"
                                    )} />
                                    <span className="text-xs font-bold truncate text-navy-900">{p.nickname || p.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-1">
                                    {sm.goals?.[p.id] && <span className="text-[10px] font-black bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-md border border-brand-100">⚽ {sm.goals[p.id]}</span>}
                                    {sm.assists?.[p.id] && <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100">👟 {sm.assists[p.id]}</span>}
                                    {isAdmin && !sm.finished && (
                                      <button onClick={(e) => { e.stopPropagation(); setActivePlayerMenu(activePlayerMenu?.playerId === p.id && activePlayerMenu?.subMatchId === sm.id ? null : { subMatchId: sm.id, playerId: p.id }); }} className="text-navy-300 hover:text-navy-900 transition-all p-1">⋮</button>
                                    )}
                                  </div>
                                  {activePlayerMenu?.playerId === p.id && activePlayerMenu?.subMatchId === sm.id && (
                                    <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 z-50 bg-white shadow-2xl border-2 border-navy-50 p-2 rounded-2xl flex flex-col gap-1 min-w-[120px] animate-fade-in">
                                      <button onClick={() => handleUpdatePlayerGoals(sm.id, p.id, idx === 0 ? 'A' : 'B', 1)} className="text-[10px] font-black p-2 hover:bg-brand-50 text-brand-700 rounded-lg text-left">⚽ + GOL</button>
                                      <button onClick={() => handleUpdatePlayerAssists(sm.id, p.id, 1)} className="text-[10px] font-black p-2 hover:bg-blue-50 text-blue-700 rounded-lg text-left">👟 + Assistência</button>
                                      <button onClick={() => handleRemovePlayerFromSubMatch(sm.id, idx === 0 ? 'A' : 'B', p.id)} className="text-[10px] font-black p-2 text-red-500 hover:bg-red-50 rounded-lg text-left border-t border-navy-50 mt-1">❌ REMOVER ATLETA</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {!sm.finished && isAdmin && (
                                <select onChange={(e) => { const p = playablePlayers.find(pl => pl.id === e.target.value); if (p) handleAddPlayerToSubMatch(sm.id, idx === 0 ? 'A' : 'B', p); e.target.value = ""; }} className="w-full text-[12px] font-black border-2 border-dashed border-navy-100 p-3 rounded-xl text-navy-400 hover:border-navy-900 hover:text-navy-900 transition-all outline-none bg-transparent cursor-pointer">
                                  <option value="">+ JOGADOR</option>
                                  {arrivedPlayers.filter(p => !sm.teamA.some(tp => tp.id === p.id) && !sm.teamB.some(tp => tp.id === p.id)).map(p => (<option key={p.id} value={p.id}>{p.nickname || p.name}</option>))}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <Modal isOpen={!!subMatchToFinish} onClose={() => setSubMatchToFinish(null)} title="Encerrar Jogo">
          <p className="mb-6">Finalizar esta partida e gravar o resultado?</p>
          <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={() => setSubMatchToFinish(null)}>Não</Button><Button variant="danger" className="flex-1" onClick={() => subMatchToFinish && handleFinishSubMatch(subMatchToFinish)}>Sim, Encerrar</Button></div>
        </Modal>
        <Modal isOpen={!!subMatchToCancel} onClose={() => setSubMatchToCancel(null)} title="Remover Jogo">
          <p className="mb-6">Deseja apagar este registro de partida?</p>
          <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={() => setSubMatchToCancel(null)}>Manter</Button><Button variant="danger" className="flex-1" onClick={() => subMatchToCancel && handleCancelSubMatch(subMatchToCancel)}>Excluir</Button></div>
        </Modal>
        <Modal isOpen={!!subMatchToReactivate} onClose={() => setSubMatchToReactivate(null)} title="Reativar Jogo">
          <p className="mb-6">Reativar jogo para edições?</p>
          <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={() => setSubMatchToReactivate(null)}>Não</Button><Button variant="brand" className="flex-1" onClick={() => subMatchToReactivate && handleReactivateSubMatch(subMatchToReactivate)}>Reativar</Button></div>
        </Modal>
        <Modal isOpen={isFinishing} onClose={() => setIsFinishing(false)} title="Finalizar Pelada">
          <p className="mb-6">Deseja encerrar o evento de hoje? Isso impedirá novos sorteios.</p>
          <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={() => setIsFinishing(false)}>Voltar</Button><Button variant="danger" className="flex-1" onClick={handleFinishMatch} isLoading={isSaving}>Finalizar</Button></div>
        </Modal>
        <Modal isOpen={!!teamToClear} onClose={() => setTeamToClear(null)} title="Limpar Time">
          <p className="mb-6">Remover todos os jogadores deste lado?</p>
          <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={() => setTeamToClear(null)}>Não</Button><Button variant="danger" className="flex-1" onClick={() => teamToClear && handleClearTeam(teamToClear.subMatchId, teamToClear.team)}>Sim, Limpar</Button></div>
        </Modal>
      </div>
    );
  }

  // Render Details (Management) View
  if (view === 'details' && selectedMatch) {
    const field = fields.find(f => f.id === selectedMatch.fieldId);
    const costPerPerson = calculateCostPerPlayer(selectedMatch);

    const sortedPlayers = [...playablePlayers].sort((a, b) => {
      const meA = checkIsMe(a);
      const meB = checkIsMe(b);
      if (meA && !meB) return -1;
      if (!meA && meB) return 1;
      return (a.nickname || a.name).localeCompare(b.nickname || b.name);
    });

    const filtered = sortedPlayers.filter(p => {
      if (playerFilter === 'confirmed') return selectedMatch.confirmedPlayerIds.includes(p.id) && !p.isGuest;
      if (playerFilter === 'paid') return (selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isGuest;
      if (playerFilter === 'monthly') return p.isGuest;
      if (playerFilter === 'all') return !p.isGuest;
      return true;
    });

    return (
      <div className="space-y-6 animate-fade-in relative pb-10">
        <Button variant="ghost" size="sm" onClick={() => { setView('list'); setSelectedMatch(null); }} leftIcon={<span>←</span>} className="pl-0 text-navy-400">Voltar para lista</Button>
        <Card className="border-l-4 border-l-brand-500 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-3xl font-black text-navy-900">{field?.name || 'Local'}</h3>
            <p className="text-navy-500 font-bold">{selectedMatch.date.split('-').reverse().join('/')} às {selectedMatch.time}</p>
          </div>
          <div className="flex gap-2">
            {!selectedMatch.finished && (
              <Button onClick={() => setView('queue')} className="bg-amber-500 hover:bg-amber-600 text-black border-none shadow-lg shadow-amber-500/20">Arena Pro</Button>
            )}
            {isAdmin && !selectedMatch.finished && <Button onClick={() => setIsFinishing(true)} variant="danger">Encerrar</Button>}
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-navy-50 border-none shadow-sm"><span className="text-[10px] uppercase font-black opacity-40">Presença</span><p className="text-2xl font-black text-navy-900">{selectedMatch.confirmedPlayerIds.length}</p></Card>
          <Card className="p-4 bg-navy-50 border-none shadow-sm"><span className="text-[10px] uppercase font-black opacity-40">Custo/Px</span><p className="text-2xl font-black text-navy-900">R$ {costPerPerson.toFixed(2)}</p></Card>
          <Card className="p-4 bg-navy-50 border-none shadow-sm"><span className="text-[10px] uppercase font-black opacity-40">Total</span><p className="text-2xl font-black text-brand-600">R$ {calculateTotalCollected(selectedMatch).toFixed(2)}</p></Card>
          <Card className="p-4 bg-navy-50 border-none shadow-sm"><span className="text-[10px] uppercase font-black opacity-40">Status</span><p className="text-lg font-black">{selectedMatch.finished ? 'Finalizado' : 'Em Aberto'}</p></Card>
        </div>

        <Card className="p-0 overflow-hidden border-2 border-navy-100">
          <div className="flex items-center justify-between border-b bg-green-50/50 pr-4">
            <div className="flex overflow-x-auto scrollbar-hide">
              {['all', 'confirmed', 'paid', 'monthly'].map(f => (
                <button key={f} onClick={() => setPlayerFilter(f as any)} className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap", playerFilter === f ? "border-brand-500 text-brand-600 bg-white" : "border-transparent text-navy-400 hover:text-navy-600")}>
                  {f === 'all' ? 'Membros' : f === 'confirmed' ? 'Confirmados' : f === 'paid' ? 'Pagos' : 'Convidados'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsPlayerListCollapsed(!isPlayerListCollapsed)}
              className="p-2 text-navy-400 hover:text-navy-900 transition-all duration-300 rounded-full hover:bg-black/5"
              style={{ transform: isPlayerListCollapsed ? 'rotate(-180deg)' : 'rotate(0deg)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {!isPlayerListCollapsed && (
            <div className="divide-y max-h-[60vh] overflow-y-auto animate-slide-down">
              {filtered.map(p => {
                const confirmed = selectedMatch.confirmedPlayerIds.includes(p.id);
                const paid = (selectedMatch.paidPlayerIds || []).includes(p.id);
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-navy-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div onClick={() => isAdmin && togglePresence(selectedMatch.id, p.id)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 shadow-sm", confirmed ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-navy-100 text-navy-300")}>{confirmed ? '✓' : ''}</div>
                      <div><p className="font-black text-sm uppercase text-navy-800 leading-none">{p.nickname || p.name}</p><span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{p.position}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && !p.isMonthlySubscriber && confirmed && p.position !== Position.GOLEIRO && (
                        <Button size="sm" variant={paid ? "brand" : "ghost"} onClick={() => togglePayment(selectedMatch.id, p.id)} className="text-[10px] h-8 px-4 font-black">{paid ? 'PAGO' : 'PAGAR'}</Button>
                      )}
                      {p.isMonthlySubscriber && <span className="w-8 h-8 rounded-full border-2 border-navy-100 bg-white flex items-center justify-center text-[10px] font-black text-navy-400">M</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {selectedMatch.subMatches && selectedMatch.subMatches.length > 0 && (
          <div className="mt-12 space-y-6">
            <h4 className="text-2xl font-black text-navy-900 uppercase tracking-tighter flex items-center gap-3">
              <span className="w-8 h-1 bg-brand-500 rounded-full"></span>
              Relatório da Arena
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
              {selectedMatch.subMatches.map((sm, idx) => (
                <Card key={sm.id} className="p-0 overflow-hidden border-2 border-navy-100 bg-white shadow-soft">
                  <div className="bg-navy-900 p-4 text-white flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-navy-300">Partida</span>
                      <span className="font-black text-sm">{sm.name || `Jogo ${idx + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                      <span className="text-2xl font-black text-brand-400">{sm.scoreA}</span>
                      <span className="text-xs font-black opacity-30 text-white">X</span>
                      <span className="text-2xl font-black text-white">{sm.scoreB}</span>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 divide-x divide-navy-50 gap-4">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-1">Time A</p>
                      <div className="space-y-2">
                        {sm.teamA.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-navy-50/50 p-2 rounded-lg border border-navy-50">
                            <span className="text-xs font-bold text-navy-800 truncate pr-2">{p.nickname || p.name}</span>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {sm.goals?.[p.id] ? <span className="text-[10px] font-black text-navy-900 bg-white px-1.5 py-0.5 rounded shadow-sm border border-navy-100">⚽ {sm.goals[p.id]}</span> : null}
                              {sm.assists?.[p.id] ? <span className="text-[10px] font-black text-blue-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-blue-100">👟 {sm.assists[p.id]}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pl-4 space-y-3">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Time B</p>
                      <div className="space-y-2">
                        {sm.teamB.map(p => (
                          <div key={p.id} className="flex justify-between items-center bg-navy-50/50 p-2 rounded-lg border border-navy-50">
                            <span className="text-xs font-bold text-navy-800 truncate pr-2">{p.nickname || p.name}</span>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {sm.goals?.[p.id] ? <span className="text-[10px] font-black text-navy-900 bg-white px-1.5 py-0.5 rounded shadow-sm border border-navy-100">⚽ {sm.goals[p.id]}</span> : null}
                              {sm.assists?.[p.id] ? <span className="text-[10px] font-black text-blue-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-blue-100">👟 {sm.assists[p.id]}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- LIST VIEW (Default Fallback) ---
  return (
    <div className="space-y-8 relative animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-3xl font-black text-navy-900 uppercase tracking-tighter">Próximos Confrontos</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-1 sm:flex-none bg-white border-2 border-navy-100 rounded-2xl py-2 px-4 font-black text-xs text-navy-900 focus:border-brand-500 outline-none" />
          {isAdmin && <Button onClick={openNewMatchModal} className="shadow-lg shadow-brand-500/20 px-6">+ NOVO</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.filter(m => m.date.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date)).map(match => {
          const field = fields.find(f => f.id === match.fieldId);
          const dateObj = new Date(match.date + 'T00:00:00');
          return (
            <Card key={match.id} onClick={() => { setSelectedMatch(match); setView('details'); }} className="group cursor-pointer hover:border-navy-900 border-2 border-transparent transition-all p-5 bg-white shadow-xl shadow-navy-900/5">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "flex flex-col items-center rounded-2xl p-3 min-w-[70px] shadow-lg transition-colors",
                  match.finished
                    ? "bg-navy-100 text-navy-900 shadow-navy-900/5"
                    : "bg-navy-900 text-white shadow-navy-900/20"
                )}>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", match.finished ? "text-navy-400" : "text-white/60")}>{dateObj.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                  <span className="text-3xl font-black leading-none my-1">{dateObj.getDate()}</span>
                  <span className={cn("text-[10px] font-black uppercase", match.finished ? "text-navy-300" : "text-white/40")}>{dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                </div>
                <div className="min-w-0 pt-1">
                  <h4 className="font-black text-navy-900 uppercase truncate text-lg group-hover:text-brand-600 transition-colors">{field?.name || 'LocalIndefinido'}</h4>
                  <p className="text-sm font-bold text-navy-400 mt-1 flex items-center gap-2"><span>🕒 {match.time}</span></p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="bg-navy-50 px-3 py-1 rounded-full"><span className="text-[10px] font-black text-navy-600 uppercase">{match.confirmedPlayerIds.length} Atletas</span></div>
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", match.finished ? "text-navy-300" : "text-brand-500 animate-pulse")}>{match.finished ? 'Encerrado' : 'Disponível'}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions (Edit/Delete) - ALWAYS VISIBLE FOR ADMINS */}
              {isAdmin && !match.finished && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditMatch(match); }}
                    className="p-2 bg-white rounded-xl shadow-lg border border-navy-100 text-navy-400 hover:text-brand-600 hover:border-brand-200 transition-all"
                    title="Editar Partida"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMatchToDelete(match.id); }}
                    className="p-2 bg-white rounded-xl shadow-lg border border-navy-100 text-navy-400 hover:text-red-600 hover:border-red-200 transition-all"
                    title="Excluir Partida"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </Card>
          );
        })}
        {matches.filter(m => m.date.startsWith(selectedMonth)).length === 0 && (
          <div className="col-span-full py-20 bg-navy-50/50 border-4 border-dashed border-navy-100 rounded-[40px] flex flex-col items-center justify-center grayscale opacity-50">
            <span className="text-6xl mb-4">🏟️</span>
            <p className="text-lg font-black text-navy-900 uppercase">Nenhum evento agendado</p>
            <p className="text-sm font-bold text-navy-400">Seja o primeiro a marcar a pelada!</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingMatchId ? 'Ajustar Pelada' : 'Novo Agendamento'}>
        <form onSubmit={handleCreateOrUpdateMatch} className="space-y-6">
          <div className="space-y-4">
            <div><label className="block text-[10px] font-black uppercase mb-2 text-navy-400 tracking-widest">Data do Jogo</label><DateInput value={date} onChange={setDate} required className="w-full bg-navy-50 border-2 border-navy-50 focus:border-brand-500 rounded-2xl px-5 py-4 font-black transition-all outline-none" /></div>
            <div><label className="block text-[10px] font-black uppercase mb-2 text-navy-400 tracking-widest">Horário</label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="h-14 rounded-2xl font-black text-lg" /></div>
            <div><label className="block text-[10px] font-black uppercase mb-2 text-navy-400 tracking-widest">Localização</label>
              <select required value={fieldId} onChange={e => setFieldId(e.target.value)} className="w-full h-14 bg-navy-50 border-2 border-navy-50 focus:border-brand-500 rounded-2xl px-5 font-black text-navy-900 transition-all outline-none appearance-none">
                <option value="">Escolha um Campo</option>
                {fields.map(f => (<option key={f.id} value={f.id}>{f.name} - R${f.hourlyRate}/h</option>))}
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-4"><Button type="button" variant="ghost" onClick={closeModal} className="flex-1 h-14 rounded-2xl uppercase font-black tracking-widest text-xs">Voltar</Button><Button type="submit" className="flex-1 h-14 shadow-xl shadow-brand-500/20 rounded-2xl uppercase font-black tracking-widest text-xs" isLoading={isSaving}>{editingMatchId ? 'Salvar' : 'Marcar Jogo'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!matchToDelete} onClose={() => setMatchToDelete(null)} title="Excluir Jogo">
        <p className="text-navy-600 mb-8 font-medium">Tem certeza que deseja cancelar esta pelada? Todos os dados de presença e pagamentos serão perdidos.</p>
        <div className="flex gap-4"><Button variant="ghost" className="flex-1 h-12" onClick={() => setMatchToDelete(null)}>Manter</Button><Button variant="danger" className="flex-1 h-12 shadow-lg shadow-red-500/20" onClick={confirmDelete}>Sim, Cancelar</Button></div>
      </Modal>
    </div>
  );
};
