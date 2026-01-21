
import React, { useState, useRef, useEffect } from 'react';
import DateInput from './DateInput';
import { Player, Position, Match, User, Group } from '../types';
import { storage } from '../services/storage';
import { authService } from '../services/auth';
import api from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PhoneInput, formatPhone } from './ui/PhoneInput';
import { Modal } from './ui/Modal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TeamAutocomplete } from './ui/TeamAutocomplete';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface PlayerScreenProps {
  players: Player[];
  matches: Match[];
  onSave: (player: Player) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroup: Group;
  currentUser: User;
  onRefresh?: () => Promise<void>;
}

interface RequestType {
  requestId: string;
  message: string;
  createdAt: string;
  user: User;
}

type SortOption = 'name' | 'rating_desc' | 'rating_asc';

export const PlayerScreen: React.FC<PlayerScreenProps> = ({ players, matches, onSave, onDelete, activeGroup, currentUser, onRefresh }) => {
  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estado de Solicitações Pendentes (Novos membros querendo entrar no grupo)
  const [pendingRequests, setPendingRequests] = useState<RequestType[]>([]);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Estados do Formulário de Edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);

  // Estado de busca global (Importação por ID)
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');

  // Estado de busca e ordenação da lista local
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [position, setPosition] = useState<Position>(Position.MEIO);
  const [rating, setRating] = useState(3);
  const [avatar, setAvatar] = useState<string>('');
  const [isMonthlySubscriber, setIsMonthlySubscriber] = useState(false);
  const [monthlyStartMonth, setMonthlyStartMonth] = useState<string>('');
  const [isGuestCheckbox, setIsGuestCheckbox] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [playerTypeFilter, setPlayerTypeFilter] = useState<'all' | 'group' | 'guests'>('all');
  const [positionsList, setPositionsList] = useState<string[]>([]);

  useEffect(() => {
    api.get('/api/positions').then((data: any) => {
      if (Array.isArray(data)) setPositionsList(data);
      else setPositionsList(Object.values(Position));
    }).catch(() => setPositionsList(Object.values(Position)));
  }, []);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const playersPerPage = 20;

  // Reseta para a página 1 sempre que os filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortOption, playerTypeFilter]);

  // Admin Permission State
  const [isAdminCheckbox, setIsAdminCheckbox] = useState(false);

  // Ensure guest cannot be monthly subscriber
  useEffect(() => {
    if (isGuestCheckbox && isMonthlySubscriber) {
      setIsMonthlySubscriber(false);
      setMonthlyStartMonth('');
    }
  }, [isGuestCheckbox, isMonthlySubscriber]);

  // Delete Modal State
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const monthlyStartMonthRef = useRef<HTMLInputElement>(null);

  const isOwner = activeGroup.adminId === currentUser.id;
  const isAdmin = isOwner || (activeGroup.admins?.includes(currentUser.id));

  useEffect(() => {
    if (isAdmin) {
      loadPendingRequests();
    }
  }, [activeGroup, isAdmin]);

  const loadPendingRequests = async () => {
    try {
      const requests = await storage.groups.getRequests(activeGroup.id);
      setPendingRequests(requests);
    } catch (error) {
      console.error("Failed to load requests", error);
    }
  };

  const handleApprove = async (userId: string) => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      await storage.groups.approveRequest(activeGroup.id, userId);
      await loadPendingRequests();
      setSuccessMessage("Usuário aprovado! Ele foi adicionado à lista de membros e de jogadores.");
      setIsSuccessModalOpen(true);
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error(error);
      alert('Erro ao aprovar solicitação.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async (userId: string) => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      await storage.groups.rejectRequest(activeGroup.id, userId);
      await loadPendingRequests();
    } catch (error) {
      console.error(error);
      alert('Erro ao rejeitar solicitação.');
    } finally {
      setIsSaving(false);
    }
  };



  // Lógica de filtragem, busca e ordenação da lista de jogadores
  const processPlayers = () => {
    let result = players.filter(player => {
      const term = searchTerm.toLowerCase();
      const matchesName = player.name.toLowerCase().includes(term);
      const matchesNickname = player.nickname && player.nickname.toLowerCase().includes(term);
      return matchesName || matchesNickname;
    });

    // Filtro por tipo: Todos, Apenas Grupo ou Apenas Convidados
    if (playerTypeFilter === 'group') {
      result = result.filter(p => !p.isGuest);
    } else if (playerTypeFilter === 'guests') {
      result = result.filter(p => p.isGuest);
    }

    // Ordenação dinâmica
    result.sort((a, b) => {
      if (sortOption === 'name') {
        const nameA = (a.nickname || a.name).toLowerCase();
        const nameB = (b.nickname || b.name).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortOption === 'rating_desc') {
        return b.rating - a.rating;
      }
      if (sortOption === 'rating_asc') {
        return a.rating - b.rating;
      }
      return 0;
    });

    return result;
  };

  const allFilteredPlayers = processPlayers();
  const totalPages = Math.ceil(allFilteredPlayers.length / playersPerPage);
  const displayedPlayers = allFilteredPlayers.slice(
    (currentPage - 1) * playersPerPage,
    currentPage * playersPerPage
  );

  // Processa o upload de imagem (Avatar) convertendo para Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem deve ser menor que 2MB.");
        return;
      }

      setIsUploading(true);

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Estado para armazenar o usuário encontrado na busca por telefone
  const [foundGlobalUser, setFoundGlobalUser] = useState<any | null>(null);

  // Busca um usuário no banco global pelo Telefone
  const handleSearchByPhone = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    setSearchFeedback('');

    if (rawPhone.length < 8) {
      setSearchFeedback("Digite um telefone válido.");
      return;
    }

    setIsSearching(true);
    setFoundGlobalUser(null);

    try {
      const res = await authService.lookupByPhone(rawPhone);

      if (res && res.found) {
        setFoundGlobalUser(res.profile ? { ...res.profile, id: res.source === 'profile' ? rawPhone : undefined } : null);
        // Pre-fill group fields
        if (res.profile) {
          setName(res.profile.name);
          setNickname(res.profile.nickname || res.profile.name.split(' ')[0]);
          setFavoriteTeam(res.profile.favoriteTeam || '');
          setPosition(res.profile.position || Position.MEIO);
          if (res.profile.birthDate) setBirthDate(res.profile.birthDate);
          if (res.profile.email) setEmail(res.profile.email);

          if (!res.profile.userId) {
            console.error("User ID missing in profile", res.profile);
            setSearchFeedback("Erro: ID de usuário ausente.");
            return;
          }
        }
      } else {
        setSearchFeedback("Nenhum usuário encontrado com este telefone.");
        // Clear fields for manual entry if NOT found
        setName('');
        setNickname('');
        setEmail('');
        setBirthDate('');
        setFavoriteTeam('');
        setAvatar('');

        // Use timeout to ensure focus happens after any re-render cycles
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error(error);
      setSearchFeedback("Erro ao buscar usuário via servidor.");
    } finally {
      setIsSearching(false);
    }
  };

  const openNewPlayerModal = () => {
    resetForm();
    setEditingId(null);
    setFoundGlobalUser(null);
    setIsModalOpen(true);

    // Auto-focus no campo de celular ao abrir
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 100);
  };

  // Salva ou atualiza um jogador no banco de dados
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // Prevent double click

    // Validation for member: MUST have at least phone and name
    if (!editingId && !foundGlobalUser) {
      if (!phone.trim()) {
        alert("Por favor, preencha o celular do jogador.");
        phoneInputRef.current?.focus();
        return;
      }
      if (!name.trim()) {
        alert("Por favor, preencha o nome completo do jogador.");
        nameInputRef.current?.focus();
        return;
      }
    }

    if (!nickname.trim()) {
      alert("Por favor, preencha o apelido do jogador.");
      nicknameInputRef.current?.focus();
      return;
    }

    if (isMonthlySubscriber && !monthlyStartMonth) {
      alert("Por favor, informe o mês de início da mensalidade.");
      monthlyStartMonthRef.current?.focus();
      return;
    }

    try {
      setIsSaving(true);

      // Se estamos editando, usamos o ID já existente.
      // Se é novo, precisamos do ID do usuário encontrado.

      /* 
         NOTA: A lógica aqui mudou.
         Novo Membro -> Adiciona user existente ao grupo (Link).
         Editar Membro -> Atualiza dados do grupo (group_players).
      */

      if (editingId) {
        // Update Logic (Existing)
        const existing = players.find(p => p.id === editingId);
        if (existing) {
          const updatedPlayer = {
            ...existing,
            nickname,
            position,
            rating,
            isMonthlySubscriber,
            monthlyStartMonth,
            isGuest: isGuestCheckbox
          };
          await onSave(updatedPlayer);

          // Handle Admin Role
          if (existing.userId && isOwner) {
            const isCurrentlyAdmin = activeGroup.admins?.includes(existing.userId);
            if (isAdminCheckbox && !isCurrentlyAdmin) {
              await storage.groups.promoteMember(activeGroup.id, existing.userId);
            } else if (!isAdminCheckbox && isCurrentlyAdmin && existing.userId !== activeGroup.adminId) {
              await storage.groups.demoteMember(activeGroup.id, existing.userId);
            }
          }
        }
      } else {
        // New Member Logic (Link or Create User)
        const targetUserId = foundGlobalUser?.userId;

        // If no user found, we send name/email/birthDate/phone/favoriteTeam to create a new one on backend
        const cleanPhone = phone.replace(/\D/g, '');
        const response: any = await api.post(`/api/groups/${activeGroup.id}/members`, {
          userId: targetUserId, // May be undefined if not found
          name,
          email,
          birthDate,
          phone: cleanPhone,
          favoriteTeam,
          nickname: nickname || name.split(' ')[0],
          position: position,
          rating: rating,
          isMonthlySubscriber: isMonthlySubscriber,
          monthlyStartMonth: isMonthlySubscriber ? monthlyStartMonth : undefined,
          isGuest: isGuestCheckbox
        });

        const newUserId = response?.userId || targetUserId;

        // Handle Admin Role for new member
        if (isAdminCheckbox && isOwner && newUserId) {
          await storage.groups.promoteMember(activeGroup.id, newUserId);
        }
      }

      closeModal();
      if (onRefresh) await onRefresh();

    } catch (err) {
      console.error(err);
      alert('Falha ao salvar membro. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (player: Player) => {
    if (!isAdmin) return;

    // Read-only global fields
    setName(player.name);
    setPhone(player.phone || '');
    setBirthDate(player.birthDate || '');
    setEmail(player.email || '');
    setFavoriteTeam(player.favoriteTeam || '');
    setAvatar(player.avatar || '');

    // Editable group fields
    setNickname(player.nickname || '');
    setPosition(player.position);
    setRating(player.rating);
    setIsMonthlySubscriber(player.isMonthlySubscriber || false);
    setMonthlyStartMonth(player.monthlyStartMonth || '');
    setIsGuestCheckbox(player.isGuest || false);

    setEditingId(player.id);
    setFoundGlobalUser({ userId: player.userId, name: player.name }); // Mock for validation pass if needed

    if (player.userId && activeGroup.admins?.includes(player.userId)) {
      setIsAdminCheckbox(true);
    } else {
      setIsAdminCheckbox(false);
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setEditingId(null);
    setFoundGlobalUser(null);
  };

  const resetForm = () => {
    setName('');
    setNickname('');
    setBirthDate('');
    setEmail('');
    setPhone('');
    setFavoriteTeam('');
    setRating(3);
    setPosition(Position.MEIO);
    setAvatar('');
    setIsAdminCheckbox(false);
    setIsMonthlySubscriber(false);
    setMonthlyStartMonth('');
    setFoundGlobalUser(null);
    setSearchFeedback('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmDelete = async () => {
    if (!playerToDelete || isSaving) return;
    try {
      setIsSaving(true);
      await onDelete(playerToDelete);
      setPlayerToDelete(null);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateAge = (dateString: string) => {
    if (!dateString) return '';
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} anos`;
  };



  return (
    <div className="space-y-6 relative animate-fade-in">
      {/* Header Actions & Search */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-2">
        <div className="flex items-center gap-4">
          <h3 className="font-heading font-bold text-navy-800 text-xl">Membros ({players.length})</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          {isAdmin && (
            <Button
              variant={pendingRequests.length > 0 ? 'danger' : 'outline'}
              onClick={() => setIsRequestsModalOpen(true)}
              className={cn("whitespace-nowrap transition-all", pendingRequests.length > 0 && "animate-pulse")}
              leftIcon={<span>🔔</span>}
            >
              Solicitações
              {pendingRequests.length > 0 && (
                <span className="ml-2 bg-white text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>
              )}
            </Button>
          )}

          <div className="relative w-full md:w-56">
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={
                <svg className="h-5 w-5 text-navy-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              }
            />
          </div>

          <div className="w-full md:w-40">
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none cursor-pointer"
              >
                <option value="name">Nome (A-Z)</option>
                <option value="rating_desc">Melhores (5★)</option>
                <option value="rating_asc">Menores (1★)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-navy-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="w-full md:w-40">
            <div className="relative">
              <select
                value={playerTypeFilter}
                onChange={(e) => setPlayerTypeFilter(e.target.value as any)}
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="group">Membros (Grupo)</option>
                <option value="guests">Convidados</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-navy-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={openNewPlayerModal} leftIcon={<span className="text-xl">+</span>} className="whitespace-nowrap">
              Novo Membro
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-navy-300 bg-white rounded-3xl border-2 border-dashed border-navy-100">
            <div className="text-6xl mb-4 opacity-50">🏃</div>
            <p className="text-lg font-medium">Nenhum jogador cadastrado.</p>
          </div>
        ) : displayedPlayers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-navy-400">
            <p className="text-lg font-medium">Nenhum jogador encontrado.</p>
          </div>
        ) : (
          displayedPlayers.map((player) => {
            const displayName = player.nickname || player.name;
            const avatarUrl = player.avatar;
            const whatsappLink = player.phone ? `https://wa.me/55${player.phone.replace(/\D/g, '')}` : null;
            const isPlayerOwner = player.userId === activeGroup.adminId;
            const isPlayerAdmin = activeGroup.admins?.includes(player.userId || '');

            const positionColorClass =
              player.position === Position.GOLEIRO ? 'bg-red-500' :
                player.position === Position.DEFENSOR ? 'bg-orange-500' :
                  player.position === Position.MEIO ? 'bg-blue-500' :
                    'bg-green-500';

            return (
              <Card key={player.id} className="p-0 overflow-hidden hover:shadow-premium-hover group" hoverEffect>
                <div className={`h-1.5 w-full ${positionColorClass}`}></div>
                <div className="p-5 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {avatarUrl && !avatarUrl.includes('ui-avatars.com') ? (
                        <img src={avatarUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
                      ) : (
                        <div className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm font-black text-2xl tracking-tighter",
                          player.isMonthlySubscriber ? "bg-green-500" :
                            player.isGuest ? "bg-orange-500" :
                              "bg-blue-500"
                        )}>
                          {player.isMonthlySubscriber ? 'M' : player.isGuest ? 'C' : 'A'}
                        </div>
                      )}
                      {isPlayerOwner && <span title="Dono do Grupo" className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-xs">👑</span>}
                      {(isPlayerAdmin || player.role === 'admin') && !isPlayerOwner && <span title="Administrador" className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-xs">🛡️</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-navy-900 truncate text-lg">
                            {player.nickname || player.name}
                          </h4>
                          {player.isGuest && (
                            <span className="text-[10px] bg-accent-100 px-1.5 py-0.5 rounded text-accent-800 border border-accent-200 font-bold uppercase tracking-wider">
                              Convidado
                            </span>
                          )}
                        </div>
                        {player.nickname && player.nickname !== player.name && (
                          <p className="text-xs text-navy-400 truncate -mt-0.5 font-medium mb-0.5">
                            {player.name}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-navy-500 flex items-center gap-2 mt-0.5">
                        <span className="font-medium bg-navy-50 px-1.5 py-0.5 rounded text-xs">{player.position}</span>
                        {player.favoriteTeam && <span className="text-xs text-navy-400">❤️ {player.favoriteTeam}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4 text-xs text-navy-500 bg-navy-50/50 p-2.5 rounded-lg border border-navy-50">
                    <span className="font-bold text-navy-400 uppercase tracking-wider">{player.birthDate ? calculateAge(player.birthDate) : '--'}</span>
                    <div className="flex text-accent-400 text-sm">
                      {'★'.repeat(Math.floor(player.rating))}
                      <span className="text-navy-100">{'★'.repeat(5 - Math.floor(player.rating))}</span>
                    </div>
                  </div>

                  {player.isMonthlySubscriber && (
                    <div className="mb-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100 w-full justify-center">
                        💳 Mensalista
                      </span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="mt-auto flex items-center justify-end gap-2 pt-3 border-t border-navy-50">
                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition-colors"
                        title="Conversar no WhatsApp"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.446-.669-.446-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306.943.32 1.286.32.395 0 1.237-.52 1.411-1.015.174-.495.174-.916.124-1.015-.05-.099-.248-.174-.545-.322z" /></svg>
                      </a>
                    )}

                    {isAdmin && (
                      <>
                        <button onClick={() => handleEdit(player)} className="text-navy-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button onClick={() => setPlayerToDelete(player.id)} className="text-navy-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Excluir">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-8 animate-fade-in">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage(prev => Math.max(prev - 1, 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 text-navy-600 font-bold hover:bg-navy-100 disabled:opacity-30"
            >
              ← Anterior
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show only a subset of pages if there are too many
                if (
                  totalPages > 7 &&
                  page !== 1 &&
                  page !== totalPages &&
                  (page < currentPage - 1 || page > currentPage + 1)
                ) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} className="px-1 text-navy-300">...</span>;
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-bold transition-all",
                      currentPage === page
                        ? "bg-brand-600 text-white shadow-md scale-110"
                        : "text-navy-500 hover:bg-navy-100"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage(prev => Math.min(prev + 1, totalPages));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 text-navy-600 font-bold hover:bg-navy-100 disabled:opacity-30 pb-1"
            >
              Próximo →
            </Button>
          </div>
          <div className="text-xs font-bold text-navy-400 uppercase tracking-widest">
            Página {currentPage} de {totalPages} • Total de {allFilteredPlayers.length} jogadores
          </div>
        </div>
      )}

      {/* Floating Action Button (Mobile) - Admin Only */}
      {isAdmin && (
        <button
          onClick={openNewPlayerModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center z-40 active:scale-90 transition-transform"
        >
          <span className="text-3xl font-light mb-1">+</span>
        </button>
      )}

      {/* Modal: Create/Edit Player */}
      {/* Modal: Create/Edit Player */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Membro' : 'Novo Membro'} width="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">

            {/* Campo de Celular (Sempre em Primeiro) */}
            <div className="md:col-span-2 bg-navy-200/50 -mx-6 px-6 py-5 border-y border-navy-100/50 mb-2">
              <label className="block text-sm font-bold text-navy-800 mb-2 ml-1 flex items-center justify-between">
                <span>Celular (WhatsApp) <span className="text-red-500">*</span></span>
                {isSearching && <span className="text-[10px] text-brand-500 animate-pulse font-black uppercase tracking-widest bg-white px-2 py-0.5 rounded-full shadow-sm">Buscando...</span>}
              </label>
              <div className="max-w-[240px]">
                <PhoneInput
                  ref={phoneInputRef}
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={setPhone}
                  onBlur={!editingId ? handleSearchByPhone : undefined}
                  disabled={!!editingId}
                  className={cn(
                    "font-mono text-lg shadow-sm bg-white",
                    !editingId && "border-brand-200 focus:ring-brand-500/20"
                  )}
                />
              </div>
              {!editingId && !foundGlobalUser && !isSearching && !searchFeedback && (
                <p className="text-[10px] text-navy-400 mt-2 ml-1 uppercase font-bold tracking-widest flex items-center gap-1">
                  <span className="text-brand-500">→</span> Digite e clique fora para buscar
                </p>
              )}
              {searchFeedback && (
                <p className={cn("text-xs font-bold mt-2 ml-1 flex items-center gap-1", searchFeedback.includes('encontrado') ? 'text-green-600' : 'text-red-500')}>
                  {searchFeedback.includes('encontrado') ? '✅' : 'ℹ️'} {searchFeedback}
                </p>
              )}
            </div>

            {/* Resultado da Busca ou Dados Atuais (Dados Globais) */}
            <div className="md:col-span-2 space-y-4">
              {/* Card Informático (Apenas se CPF encontrado ou editando) */}
              {(editingId || foundGlobalUser) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-14 h-14 rounded-full bg-slate-200 shrink-0 overflow-hidden border-2 border-white shadow-sm">
                    <img src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}`} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-navy-900 truncate">{name || 'Jogador'}</h4>
                    <p className="text-xs text-navy-500 truncate">{email || 'Sem email cadastrado'}</p>
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-tighter">Perfil Global {editingId ? 'de' : 'Encontrado'}</span>
                  </div>
                </div>
              )}

              {/* Campos Globais (Nome, Data, Email, Time) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input
                    ref={nameInputRef}
                    label="Nome Completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    disabled={!!editingId || !!foundGlobalUser}
                    className={cn((!!editingId || !!foundGlobalUser) && "bg-slate-50 opacity-70")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Nascimento</label>
                  <DateInput
                    value={birthDate}
                    onChange={(v) => setBirthDate(v)}
                    required
                    disabled={!!editingId || !!foundGlobalUser}
                    className={cn(
                      "w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 transition-all font-medium",
                      (!!editingId || !!foundGlobalUser) && "bg-slate-50 opacity-70"
                    )}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@exemplo.com"
                    disabled={!!editingId || !!foundGlobalUser}
                    className={cn((!!editingId || !!foundGlobalUser) && "bg-slate-50 opacity-70")}
                  />
                </div>
                <div className="md:col-span-2">
                  <TeamAutocomplete
                    label="Time do Coração"
                    value={favoriteTeam}
                    onChange={setFavoriteTeam}
                    placeholder="Ex: Flamengo"
                    disabled={!!editingId || !!foundGlobalUser}
                    className={cn((!!editingId || !!foundGlobalUser) && "bg-slate-50 opacity-70")}
                  />
                </div>
              </div>
            </div>

            {/* Configurações do Grupo */}
            <div className="md:col-span-2">
              <h5 className="font-bold text-navy-800 border-b border-navy-100 pb-2 mb-1 flex items-center gap-2">
                <span>⚙️</span> Configurações no {activeGroup.name}
              </h5>
            </div>

            <div className="md:col-span-1">
              <Input
                ref={nicknameInputRef}
                label="Apelido no Grupo"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Joga muito"
                required
                disabled={!editingId && !foundGlobalUser && !phone}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Posição Principal</label>
              <div className="relative">
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as Position)}
                  disabled={!editingId && !foundGlobalUser && !phone}
                  className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none disabled:bg-slate-50 disabled:text-navy-300"
                >
                  {positionsList.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-navy-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-navy-700 mb-1 ml-1 flex justify-between">
                <span>Nível de Habilidade (1-5)</span>
                <span className="font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-xs">{rating}★</span>
              </label>
              <div className="flex items-center gap-4 px-2">
                <span className="text-xs font-bold text-navy-300">Perna de Pau</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  disabled={!editingId && !foundGlobalUser && !phone}
                  className="flex-1 h-2 bg-navy-100 rounded-lg appearance-none cursor-pointer accent-brand-600 disabled:opacity-50"
                />
                <span className="text-xs font-bold text-brand-500">Craque</span>
              </div>
            </div>

            {/* Admin Checkbox */}
            {isOwner && (editingId || foundGlobalUser) && (
              <div className="md:col-span-2 flex items-center gap-3 p-4 bg-yellow-50 rounded-2xl border border-yellow-100 group transition-all hover:bg-yellow-100/50">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={isAdminCheckbox}
                    onChange={(e) => setIsAdminCheckbox(e.target.checked)}
                    className="w-5 h-5 rounded-md border-yellow-400 text-yellow-600 focus:ring-yellow-500 cursor-pointer"
                  />
                </div>
                <label htmlFor="isAdmin" className="text-sm font-bold text-yellow-900 cursor-pointer select-none">
                  Definir como Administrador do Grupo
                  <span className="block text-[10px] text-yellow-700/70 font-medium">Permite gerenciar jogos, jogadores e financeiro</span>
                </label>
              </div>
            )}

            {/* Subscription Checkbox */}
            <div className="md:col-span-2 space-y-3">
              <div className={cn(
                "flex items-center gap-3 p-4 border rounded-2xl transition-all cursor-pointer",
                isMonthlySubscriber ? "bg-green-50 border-green-200" : "bg-white border-navy-100 hover:border-navy-200"
              )}>
                <input
                  type="checkbox"
                  id="isMonthly"
                  checked={isMonthlySubscriber}
                  onChange={(e) => setIsMonthlySubscriber(e.target.checked)}
                  disabled={!editingId && !foundGlobalUser && !phone}
                  className="w-5 h-5 rounded-md border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-30"
                />
                <label htmlFor="isMonthly" className="text-sm font-bold text-navy-800 cursor-pointer select-none flex-1">
                  É Mensalista (Paga mensalidade fixa)
                  <span className="block text-[10px] text-navy-400 font-medium">Usa o controle de caixa para mensalidades</span>
                </label>
              </div>

              {/* Guest Checkbox */}
              <div className={cn(
                "flex items-center gap-3 p-4 border rounded-2xl transition-all cursor-pointer",
                isGuestCheckbox ? "bg-orange-50 border-orange-200" : "bg-white border-navy-100 hover:border-navy-200"
              )}>
                <input
                  type="checkbox"
                  id="isGuest"
                  checked={isGuestCheckbox}
                  onChange={(e) => setIsGuestCheckbox(e.target.checked)}
                  disabled={!editingId && !foundGlobalUser && !phone}
                  className="w-5 h-5 rounded-md border-navy-300 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-30"
                />
                <label htmlFor="isGuest" className="text-sm font-bold text-navy-800 cursor-pointer select-none flex-1">
                  É Convidado (Participação ocasional)
                  <span className="block text-[10px] text-navy-400 font-medium">Define se o jogador é apenas um visitante</span>
                </label>
              </div>

              {isMonthlySubscriber && (
                <div className="animate-in slide-in-from-left-2 duration-200 pl-4 border-l-2 border-brand-200 space-y-2">
                  <label className="block text-[10px] font-black text-brand-600 uppercase tracking-widest">Mês de Início das Cobranças</label>
                  <Input
                    ref={monthlyStartMonthRef}
                    type="month"
                    value={monthlyStartMonth}
                    onChange={(e) => setMonthlyStartMonth(e.target.value)}
                    className="w-full max-w-[200px]"
                    required={isMonthlySubscriber}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex gap-3 pt-4 border-t border-navy-50">
              <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">Cancelar</Button>
              <Button
                type="submit"
                className="flex-[2] text-lg"
                isLoading={isSearching || isSaving}
                disabled={isSaving || isSearching || (!editingId && !foundGlobalUser && !phone)}
              >
                {editingId ? 'Salvar Alterações' : 'Concluir Cadastro'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>



      {/* Modal: Pending Requests */}
      {/* Modal: Pending Requests */}
      <Modal isOpen={isRequestsModalOpen} onClose={() => setIsRequestsModalOpen(false)} title="Solicitações Pendentes" width="lg">
        <div className="overflow-y-auto max-h-[60vh]">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="w-16 h-16 bg-navy-50 rounded-full flex items-center justify-center text-3xl mb-3">📭</div>
              <p className="text-navy-500 font-medium">Nenhuma solicitação pendente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(req => (
                <div key={req.requestId} className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-xl border border-navy-100 shadow-sm relative">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={req.user.avatar || `https://ui-avatars.com/api/?name=${req.user.name}`} className="w-12 h-12 rounded-full border-2 border-white shadow-sm shrink-0" alt={req.user.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                        <p className="font-bold text-navy-900 text-lg">{req.user.name}</p>
                        <span className="text-xs text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-sm text-navy-600">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-navy-400 tracking-wider">Email:</span>
                          <span className="truncate">{req.user.email || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase text-navy-400 tracking-wider">Celular:</span>
                          <span className="font-mono">{formatPhone(req.user.phone || req.user.id)}</span>
                        </div>
                      </div>

                      {req.message && (
                        <div className="mt-3 p-3 bg-brand-50/50 rounded-lg border border-brand-100 text-sm text-navy-800 italic relative">
                          <span className="absolute -top-2 left-3 bg-brand-100 text-brand-700 text-[10px] font-bold px-2 rounded">Mensagem</span>
                          "{req.message}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-navy-50 pt-3 md:pt-0 md:pl-4">
                    <Button size="sm" onClick={() => handleApprove(req.user.id)} className="w-full">Aprovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleReject(req.user.id)} className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100">Recusar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!playerToDelete} onClose={() => setPlayerToDelete(null)} title="Excluir Jogador">
        <p className="text-navy-600 mb-6">
          Tem certeza que deseja remover este jogador do elenco? O histórico dele nas partidas será mantido.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setPlayerToDelete(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete} className="flex-1">Sim, Excluir</Button>
        </div>
      </Modal>
      {/* Modal: Success Feedback */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        title="Sucesso!"
        width="sm"
      >
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
            ✅
          </div>
          <p className="text-navy-700 font-medium mb-6 px-4">
            {successMessage}
          </p>
          <Button onClick={() => setIsSuccessModalOpen(false)} className="w-full">
            Entendido
          </Button>
        </div>
      </Modal>
    </div >
  );
};
