
import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';
import { Player, Field, Match, User, Group, Position, Comment } from '../types';
import { balanceTeamsWithAI } from '../services/geminiService';
import { storage } from '../services/storage';
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
  onRefresh?: () => Promise<void>;
}

export const MatchScreen: React.FC<MatchScreenProps> = ({ players, fields, matches, onSave, onDelete, activeGroupId, currentUser, activeGroup, onRefresh }) => {
  // Estados de Controle de Visualização
  const [view, setView] = useState<'list' | 'details'>('list');
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

  // Gerenciamento de Convidados
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>(Position.MEIO);
  const [hideGuests, setHideGuests] = useState(false);

  // Equilíbrio de Times com Inteligência Artificial
  const [isBalancing, setIsBalancing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

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

  const currentMonth = () => new Date().toISOString().split('T')[0].slice(0, 7);
  // Sincroniza o status de pagamento mensal dos jogadores do grupo
  const loadMonthlyStatus = async () => {
    try {
      setIsMonthlyLoading(true);
      const txs = await storage.transactions.getAll(activeGroupId);
      const m = currentMonth();
      const map: Record<string, string> = {};

      // Mapeia quem já pagou a mensalidade no mês atual
      txs.forEach(t => {
        if (t.category === 'MONTHLY_FEE' && (t.date || '').slice(0, 7) === m && t.relatedPlayerId) {
          map[t.relatedPlayerId] = t.id;
        }
      });
      setMonthlyTxMap(map);

      // Busca a transação agregada que representa a soma das mensalidades no fluxo de caixa
      const aggregate = txs.find(t => t.category === 'MONTHLY_FEE' && !t.relatedPlayerId && (t.date || '').slice(0, 7) === m && (t.description || '').toLowerCase().includes('mensalistas'));
      setMonthlyAggregateId(aggregate ? aggregate.id : null);

      await syncMonthlyAggregate(Object.keys(map).length);
    } catch {
      setMonthlyTxMap({});
      setMonthlyAggregateId(null);
    } finally {
      setIsMonthlyLoading(false);
    }
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
      id: monthlyAggregateId || crypto.randomUUID(),
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
    const genId = () => {
      const c: any = (window as any).crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    };
    const c: Comment = {
      id: genId(),
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
    const genId = () => {
      const c: any = (window as any).crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    };
    const c: Comment = {
      id: genId(),
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
        const txId = crypto.randomUUID();
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
        const genId = () => {
          const c: any = (window as any).crypto;
          if (c && typeof c.randomUUID === 'function') return c.randomUUID();
          return 'match_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        };

        matchToSave = {
          id: genId(),
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
      if (confirmedCount > 0 && costPerPersonSync > 0) {
        const totalAmount = newPaidList.length * costPerPersonSync;
        const description = `Pagamentos Avulsos - ${match.date.split('-').reverse().join('/')} - ${field.name}`;
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

  const handleGenerateTeams = async (match: Match) => {
    if (!isAdmin || isBalancing || isSaving) return;
    if (match.confirmedPlayerIds.length < 2) {
      alert("Selecione pelo menos 2 jogadores confirmados para dividir os times.");
      return;
    }

    setIsBalancing(true);
    setIsSaving(true); // Set isSaving
    setAiReasoning(null);

    try {
      const confirmedPlayers = players.filter(p => match.confirmedPlayerIds.includes(p.id));
      const { teamAIds, teamBIds, reasoning } = await balanceTeamsWithAI(confirmedPlayers);

      const updatedMatch = {
        ...match,
        teamA: confirmedPlayers.filter(p => teamAIds.includes(p.id)),
        teamB: confirmedPlayers.filter(p => teamBIds.includes(p.id))
      };

      await onSave(updatedMatch);
      setSelectedMatch(updatedMatch);
      setAiReasoning(reasoning);

    } catch (error) {
      alert("Erro ao gerar times. Verifique sua chave de API ou tente novamente.");
    } finally {
      setIsBalancing(false);
      setIsSaving(false); // Reset isSaving
    }
  };

  const handleFinishMatch = async () => {
    if (!selectedMatch || !isAdmin || isSaving) return;

    const updatedMatch = {
      ...selectedMatch,
      finished: true,
      scoreA,
      scoreB,
      mvpId: mvpId || undefined
    };

    try {
      setIsSaving(true);
      await onSave(updatedMatch);

      setIsFinishing(false);
      setSelectedMatch(null);
      setView('list');
    } finally {
      setIsSaving(false);
    }
  };

  const getDisplayName = (p: Player) => p.nickname || p.name;

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
      { key: 'unpaid', label: `A Pagar (${players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id) && !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber).length})` },
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
        return isConfirmed && !isPaid && !isMonthly;
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
        ? confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id))
        : confirmedPlayersForFinished;

    return (
      <div className="space-y-6 relative animate-fade-in">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setView('list'); setIsFinishing(false); setSelectedMatch(null); setPlayerFilter('all'); }}
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
                  <h2 className="text-2xl font-bold text-navy-900 mb-1">Jogo: {selectedMatch.date.split('-').reverse().join('/')}</h2>
                  <p className="text-brand-600 font-medium text-lg flex items-center gap-2">
                    <span>⏰ {selectedMatch.time}</span>
                    <span className="w-1.5 h-1.5 bg-navy-300 rounded-full"></span>
                    <span>📍 {fieldName}</span>
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const confirmados = players.filter(p => selectedMatch.confirmedPlayerIds.includes(p.id));
                    const lista = confirmados.map((p, i) => `${i + 1}. ${p.nickname || p.name} ${!p.isMonthlySubscriber && !selectedMatch.paidPlayerIds?.includes(p.id) ? '❌' : '✅'}`).join('\n');
                    const text = `*FUTEBOL - ${selectedMatch.date.split('-').reverse().join('/')}* ⚽\n📍 Local: ${fieldName}\n⏰ Horário: ${selectedMatch.time}\n💰 Valor: R$ ${costPerPerson.toFixed(2)}\n\n*Confirmados (${selectedMatch.confirmedPlayerIds.length}):*\n${lista}\n\n_Gerado por Futgol App_`;

                    if (navigator.share) {
                      try { await navigator.share({ title: 'Lista de Presença', text }); } catch (e) { console.log(e); }
                    } else {
                      await navigator.clipboard.writeText(text);
                      alert('Lista copiada para a área de transferência!');
                    }
                  }}
                  className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors flex items-center gap-2 text-sm font-bold shadow-sm border border-brand-100"
                  title="Compartilhar Lista"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="hidden sm:inline">Compartilhar</span>
                </button>
              </div>

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
                          { id: 'unpaid', label: `A Pagar (${confirmedPlayersForFinished.filter(p => !(selectedMatch.paidPlayerIds || []).includes(p.id) && !p.isMonthlySubscriber).length})` }
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
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
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
                <h3 className="font-bold text-lg text-navy-900">Lista de Jogadores</h3>
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

                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "p-3 rounded-xl border transition-all flex items-center justify-between group select-none",
                          isMe ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50/50" : "bg-white",
                          isConfirmed
                            ? "border-brand-200 bg-brand-50/30"
                            : "border-navy-100 hover:border-navy-300"
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

                          {/* Avatar */}
                          <div className="shrink-0">
                            {player.avatar && !player.avatar.includes('ui-avatars.com') ? (
                              <img src={player.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" alt="Avatar" />
                            ) : (
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-white border border-white shadow-sm font-bold text-[10px]",
                                player.isMonthlySubscriber ? "bg-green-500" :
                                  player.isGuest ? "bg-orange-500" : "bg-blue-500"
                              )}>
                                {player.isMonthlySubscriber ? 'M' : player.isGuest ? 'C' : 'A'}
                              </div>
                            )}
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
                              <span className="text-xs text-navy-400">{player.position}</span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Action (Only Admin) */}
                        {isConfirmed && isAdmin && (
                          <div className="ml-2 pl-2 border-l border-navy-200">
                            {player.isMonthlySubscriber ? (
                              <div
                                title={isMonthlyPaid(player.id) ? 'Mensalidade paga' : 'Mensalidade pendente'}
                                onClick={() => toggleMonthlyFee(player)}
                                className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110",
                                  isMonthlyPaid(player.id) ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' : 'bg-red-50 text-red-500 ring-1 ring-red-200'
                                )}
                              >
                                M
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant={isPaid ? "ghost" : "danger"}
                                onClick={() => togglePayment(selectedMatch.id, player.id)}
                                className={cn("h-7 text-xs px-2", isPaid && "text-brand-600 hover:text-brand-700")}
                                disabled={updatingPaymentFor === player.id}
                                isLoading={updatingPaymentFor === player.id}
                              >
                                {isPaid ? 'Pago' : 'Pagar'}
                              </Button>
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
                    ? (confirmedCount < 2 ? "Selecione jogadores para gerar times." : "Pronto para escalar.")
                    : "Confirme sua presença para jogar."}
                </p>

                {/* ADMIN ONLY ACTIONS */}
                {isAdmin && (
                  <div className="flex gap-3 w-full md:w-auto">
                    {/* Button: Generate Teams */}
                    <Button
                      onClick={() => handleGenerateTeams(selectedMatch)}
                      isLoading={isBalancing}
                      variant="secondary"
                      className="flex-1 md:flex-none"
                    >
                      Escalar Times
                    </Button>

                    {/* Button: Finish Match */}
                    <Button
                      onClick={() => setIsFinishing(true)}
                      variant="primary"
                      className="flex-none bg-navy-800 hover:bg-navy-900 text-white shadow-lg"
                    >
                      🏁 Encerrar
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Teams Display */}
            {(selectedMatch.teamA.length > 0 || selectedMatch.teamB.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                <Card className="border-t-4 border-brand-500 shadow-lg">
                  <h3 className="font-heading font-bold text-brand-700 text-xl mb-4 text-center">Time A (Colete)</h3>
                  <div className="divide-y divide-navy-50">
                    {selectedMatch.teamA.map(p => (
                      <div key={p.id} className="py-2.5 flex justify-between items-center text-sm px-3 hover:bg-navy-50 rounded-xl transition-colors">
                        <span className="text-navy-900 font-bold flex items-center gap-3 min-w-0">
                          {p.avatar && !p.avatar.includes('ui-avatars.com') ? (
                            <img src={p.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm object-cover shrink-0" alt="" />
                          ) : (
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white border border-white shadow-sm font-bold text-[10px] shrink-0",
                              p.isMonthlySubscriber ? "bg-green-500" :
                                p.isGuest ? "bg-orange-500" : "bg-blue-500"
                            )}>
                              {p.isMonthlySubscriber ? 'M' : p.isGuest ? 'C' : 'A'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate">{getDisplayName(p)}</div>
                            {p.nickname && p.nickname !== p.name && (
                              <div className="text-[10px] text-navy-400 truncate leading-tight mt-0.5 font-medium">{p.name}</div>
                            )}
                          </div>
                        </span>
                        <span className="text-navy-400 text-xs font-medium bg-navy-50 px-2 py-1 rounded">{p.position}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="border-t-4 border-red-500 shadow-lg">
                  <h3 className="font-heading font-bold text-red-600 text-xl mb-4 text-center">Time B (Sem Colete)</h3>
                  <div className="divide-y divide-navy-50">
                    {selectedMatch.teamB.map(p => (
                      <div key={p.id} className="py-2.5 flex justify-between items-center text-sm px-3 hover:bg-navy-50 rounded-xl transition-colors">
                        <span className="text-navy-900 font-bold flex items-center gap-3 min-w-0">
                          {p.avatar && !p.avatar.includes('ui-avatars.com') ? (
                            <img src={p.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm object-cover shrink-0" alt="" />
                          ) : (
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white border border-white shadow-sm font-bold text-[10px] shrink-0",
                              p.isMonthlySubscriber ? "bg-green-500" :
                                p.isGuest ? "bg-orange-500" : "bg-blue-500"
                            )}>
                              {p.isMonthlySubscriber ? 'M' : p.isGuest ? 'C' : 'A'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate">{getDisplayName(p)}</div>
                            {p.nickname && p.nickname !== p.name && (
                              <div className="text-[10px] text-navy-400 truncate leading-tight mt-0.5 font-medium">{p.name}</div>
                            )}
                          </div>
                        </span>
                        <span className="text-navy-400 text-xs font-medium bg-navy-50 px-2 py-1 rounded">{p.position}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {aiReasoning && (
                  <div className="col-span-full p-4 bg-indigo-50 text-indigo-800 rounded-xl text-sm border border-indigo-100 flex gap-3 items-start animate-fade-in">
                    <span className="text-xl">🤖</span>
                    <div><strong className="block mb-1">Análise da IA:</strong> {aiReasoning}</div>
                  </div>
                )}
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-navy-800">Mural do Jogo</h3>
                <button onClick={loadComments} className="text-xs text-brand-600 font-bold hover:underline">Atualizar</button>
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
          </>
        )}

        {/* Modal: Finish Match */}
        {isFinishing && !selectedMatch.finished && isAdmin && (
          <Modal isOpen={isFinishing} onClose={() => setIsFinishing(false)} title="Encerrar Partida">
            <div className="space-y-6">
              <div className="bg-navy-50 p-6 rounded-2xl flex items-center justify-center gap-8">
                <div className="text-center">
                  <label className="block text-xs font-bold text-navy-500 mb-2 uppercase tracking-wider">Time A</label>
                  <input
                    type="number"
                    min="0"
                    value={scoreA}
                    onChange={(e) => setScoreA(Number(e.target.value))}
                    className="w-20 h-20 text-center text-4xl font-bold bg-white text-brand-600 border-2 border-transparent focus:border-brand-500 rounded-2xl outline-none shadow-sm transition-all"
                  />
                </div>
                <span className="text-3xl font-bold text-navy-200">X</span>
                <div className="text-center">
                  <label className="block text-xs font-bold text-navy-500 mb-2 uppercase tracking-wider">Time B</label>
                  <input
                    type="number"
                    min="0"
                    value={scoreB}
                    onChange={(e) => setScoreB(Number(e.target.value))}
                    className="w-20 h-20 text-center text-4xl font-bold bg-white text-red-600 border-2 border-transparent focus:border-red-500 rounded-2xl outline-none shadow-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-navy-700 mb-2">Craque da Partida (MVP) 🏆</label>
                <select
                  value={mvpId}
                  onChange={(e) => setMvpId(e.target.value)}
                  className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
                >
                  <option value="">-- Selecione o destaque --</option>
                  {selectedMatch.confirmedPlayerIds.map(id => {
                    const p = players.find(player => player.id === id);
                    return p ? <option key={p.id} value={p.id}>{getDisplayName(p)}</option> : null;
                  })}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsFinishing(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleFinishMatch} className="flex-1" isLoading={isSaving} disabled={isSaving}>Confirmar Resultado</Button>
              </div>
            </div>
          </Modal>
        )}

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

      </div>
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
                  "relative overflow-hidden cursor-pointer group border-l-4",
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
                      <div className="mt-3 inline-flex items-center gap-2 bg-navy-100 px-3 py-1 rounded-full">
                        <span className="text-xs font-bold text-navy-600 uppercase tracking-widest">Placar</span>
                        <span className="text-sm font-bold text-navy-900">{match.scoreA} x {match.scoreB}</span>
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
                {!isFinished && isAdmin && (
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
                )}
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
      {isAdmin && (
        <button
          onClick={openNewMatchModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center z-40 active:scale-90 transition-transform"
        >
          <span className="text-3xl font-light mb-1">+</span>
        </button>
      )}

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
    </div>
  );
};
