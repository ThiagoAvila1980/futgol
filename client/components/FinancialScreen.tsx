
import React, { useState, useEffect, useMemo } from 'react';
import DateInput from './DateInput';
import { Transaction, Player, Group, TransactionType } from '../types';
import { storage } from '../services/storage';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { CurrencyInput } from './ui/CurrencyInput';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, Plus, DollarSign, TrendingUp, TrendingDown, Calendar, Pencil, Trash2, CheckCircle2, XCircle, Clock as ClockIcon, Filter, ChevronLeft, ChevronRight, AlertCircle, MoreVertical, Users } from 'lucide-react';

interface FinancialScreenProps {
  activeGroup: Group;
  players: Player[];
}

export const FinancialScreen: React.FC<FinancialScreenProps> = ({ activeGroup, players }) => {
  // Estados de Dados e Carregamento
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de Filtro de Data (Padrão: Mês Atual)
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('OTHER');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [otherDescription, setOtherDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Menu State
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Quick Pay Modal (Monthly)
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Delete Confirmation State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Status Modal (Feedback)
  const [statusModal, setStatusModal] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const selectedMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthlyCandidates = useMemo(() => {
    return players.filter(p =>
      p.isMonthlySubscriber &&
      (!p.monthlyStartMonth || selectedMonthPrefix >= p.monthlyStartMonth)
    );
  }, [players, selectedMonthPrefix]);

  // Rótulos amigáveis para as categorias financeiras
  const categoryLabels: Record<string, string> = {
    MATCH_REVENUE: 'Receita de Jogo',
    MONTHLY_FEE: 'Mensalidade',
    FIELD_RENT: 'Aluguel de Quadra',
    EQUIPMENT: 'Equipamentos',
    EVENT_BBQ: 'Churrasco/Evento',
    GIFTS: 'Brindes/Prêmios',
    DONATION: 'Doação',
    SPONSORSHIP: 'Patrocínio',
    OTHER: 'Outros'
  };

  const expenseCategories = [
    { id: 'FIELD_RENT', label: 'Aluguel de Campo/Quadra' },
    { id: 'EQUIPMENT', label: 'Equipamentos (Bola, Colete...)' },
    { id: 'EVENT_BBQ', label: 'Churrasco' },
    { id: 'GIFTS', label: 'Brindes' },
    { id: 'OTHER', label: 'Outros' }
  ];

  const incomeCategories = [
    { id: 'MATCH_REVENUE', label: 'Receita de Jogos' },
    { id: 'MONTHLY_FEE', label: 'Mensalidade' },
    { id: 'DONATION', label: 'Doação' },
    { id: 'SPONSORSHIP', label: 'Patrocínio' },
    { id: 'OTHER', label: 'Outros' }
  ];

  useEffect(() => {
    loadTransactions();
  }, [activeGroup.id]);

  useEffect(() => {
    if (isModalOpen) {
      setCategory(type === 'EXPENSE' ? 'FIELD_RENT' : 'MATCH_REVENUE');
    }
  }, [type, isModalOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    const data = await storage.transactions.getAll(activeGroup.id);
    data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(data);
    setLoading(false);
  };

  const calculateBalance = () => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, total: income - expense };
  };

  const { income, expense, total } = calculateBalance();

  const earliestDate = useMemo(() => {
    if (transactions.length === 0) return '';
    let min = transactions[0].date;
    for (const t of transactions) {
      if (t.date < min) min = t.date;
    }
    return min;
  }, [transactions]);

  useEffect(() => {
    if (!earliestDate) return;
    if (filterStartDate < earliestDate) setFilterStartDate(earliestDate);
    if (filterEndDate < earliestDate) setFilterEndDate(earliestDate);
  }, [earliestDate]);

  const filteredTransactions = transactions.filter(t => {
    return t.date >= filterStartDate && t.date <= filterEndDate;
  });

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  const hasPaidSelectedMonth = (playerId: string) => {
    return transactions.some(t =>
      (t.relatedPlayerId === playerId || t.paidPlayerIds?.includes(playerId)) &&
      t.category === 'MONTHLY_FEE' &&
      t.date.startsWith(selectedMonthPrefix)
    );
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // Prevent double click
    if (!description || !amount) return;

    try {
      setIsSaving(true);
      let finalDescription = description;
      if (category === 'OTHER' && otherDescription.trim()) {
        finalDescription += ` - ${otherDescription.trim()}`;
      }

      const newTx: Transaction = {
        id: editingId || generateId(),
        groupId: activeGroup.id,
        description: finalDescription,
        amount: parseFloat(amount) / 100, // Ajustado para CurrencyInput que armazena cents
        type,
        category: category as any,
        date: transactionDate
      };

      await storage.transactions.save(newTx);

      // Ajustar filtros para garantir que o novo lançamento apareça no histórico
      if (newTx.date < filterStartDate) setFilterStartDate(newTx.date);
      if (newTx.date > filterEndDate) setFilterEndDate(newTx.date);

      await loadTransactions();
      closeModal();

      setStatusModal({
        show: true,
        type: 'success',
        title: 'Lançamento Salvo!',
        message: 'A movimentação foi registrada com sucesso e o saldo atualizado.'
      });
    } catch (error: any) {
      console.error("Erro ao salvar transação:", error);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Falha no Lançamento',
        message: error?.message || 'Não foi possível salvar a movimentação. Verifique os dados e tente novamente.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayMonthlyFee = async (player: Player) => {
    setProcessingId(player.id);
    setSuccessId(null);

    try {
      const amountValue = Number(activeGroup.monthlyFee || 0);
      const paymentDate = `${selectedMonthPrefix}-01`;

      await storage.transactions.upsertMonthlyTransaction(
        activeGroup.id,
        player.id,
        amountValue,
        paymentDate
      );

      // Garantir que o recebimento apareça no histórico se estiver fora do filtro atual
      if (paymentDate < filterStartDate) setFilterStartDate(paymentDate);
      if (paymentDate > filterEndDate) setFilterEndDate(paymentDate);

      await loadTransactions();
      setSuccessId(player.id);

      setTimeout(() => {
        setSuccessId(null);
      }, 2000);

    } catch (error: any) {
      console.error("Erro ao registrar pagamento:", error);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Erro no Recebimento',
        message: 'Não foi possível registrar o pagamento desta mensalidade.'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!transactionToDelete || isSaving) return;
    try {
      setIsSaving(true);
      await storage.transactions.delete(transactionToDelete);
      setTransactionToDelete(null);
      await loadTransactions();
      setStatusModal({
        show: true,
        type: 'success',
        title: 'Removido!',
        message: 'O lançamento foi excluído e o saldo recalculado.'
      });
    } catch (error: any) {
      console.error(error);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'Erro ao Excluir',
        message: 'Houve um problema ao tentar apagar este registro.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDescription('');
    setAmount('');
    setType('EXPENSE');
    setCategory('OTHER');
    setOtherDescription('');
    setEditingId(null);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setDescription(tx.description);
    setAmount((tx.amount * 100).toFixed(0));
    setType(tx.type);
    setCategory(tx.category);
    setTransactionDate(tx.date);
    setMenuOpenId(null);
    setIsModalOpen(true);
  };

  const currentMonthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('pt-BR', { month: 'long' });
  const availableCategories = type === 'EXPENSE' ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-6 pb-4 animate-fade-in">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-heading font-bold text-navy-900 text-xl">Financeiro</h2>
          <p className="text-navy-500 text-sm">Controle de caixa, mensalidades e despesas.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsMonthlyModalOpen(true)}
            leftIcon={<span>📋</span>}
          >
            Mensalistas
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            leftIcon={<span>+</span>}
          >
            Lançamento
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Card className="border-l-4 border-l-brand-500 hover:shadow-premium-hover transition-all pb-2 pt-2">
          <p className="text-sm text-navy-500 font-bold uppercase tracking-wider">Saldo em Caixa</p>
          <h3 className={cn(
            "font-heading font-bold text-3xl mt-2",
            total >= 0 ? "text-brand-600" : "text-red-600"
          )}>
            R$ {total.toFixed(2)}
          </h3>
          <p className="text-xs text-navy-400 mt-1">Acumulado total</p>
        </Card>
        <Card className="border-l-4 border-l-blue-500 hover:shadow-premium-hover transition-all pb-2 pt-2">
          <p className="text-sm text-navy-500 font-bold uppercase tracking-wider">Receitas</p>
          <h3 className="font-heading font-bold text-3xl mt-2 text-blue-600">
            R$ {income.toFixed(2)}
          </h3>
          <p className="text-xs text-navy-400 mt-1">Total arrecadado</p>
        </Card>
        <Card className="border-l-4 border-l-red-500 hover:shadow-premium-hover transition-all pb-2 pt-2">
          <p className="text-sm text-navy-500 font-bold uppercase tracking-wider">Despesas</p>
          <h3 className="font-heading font-bold text-3xl mt-2 text-red-500">
            R$ {expense.toFixed(2)}
          </h3>
          <p className="text-xs text-navy-400 mt-1">Total gasto</p>
        </Card>
      </div>

      {/* Lista de Transações ----------------------------------------------------- */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-navy-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-navy-50/50">
          <div className="font-bold text-navy-800 flex items-center gap-3">
            <span className="text-lg">📄</span>
            Histórico
            <span className="text-xs font-normal bg-white border border-navy-100 px-2 py-0.5 rounded-full text-navy-500 shadow-sm">{filteredTransactions.length} registros</span>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-navy-200 shadow-sm">
            <div className="flex items-center gap-2 px-3">
              <span className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">De</span>
              <DateInput
                value={filterStartDate}
                onChange={(v) => setFilterStartDate(v)}
                className="text-sm text-navy-800 font-bold bg-transparent focus:outline-none cursor-pointer w-32"
                max={new Date().toISOString().split('T')[0]}
                min={earliestDate || undefined}
              />
            </div>
            <div className="w-px h-6 bg-navy-100"></div>
            <div className="flex items-center gap-2 px-3">
              <span className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">Até</span>
              <DateInput
                value={filterEndDate}
                onChange={(v) => setFilterEndDate(v)}
                className="text-sm text-navy-800 font-bold bg-transparent focus:outline-none cursor-pointer w-32"
                max={new Date().toISOString().split('T')[0]}
                min={earliestDate || undefined}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-navy-400">Carregando movimentações...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-navy-400 flex flex-col items-center">
            <div className="text-4xl mb-2 opacity-50">📉</div>
            <p className="text-lg font-medium text-navy-600">Nenhuma movimentação neste período.</p>
            <p className="text-sm mt-1">Tente ajustar as datas no filtro acima.</p>
          </div>
        ) : (
          <div className="divide-y divide-navy-50 max-h-[500px] overflow-y-auto">
            {filteredTransactions.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-navy-50 transition-colors group gap-4">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy-900 truncate" title={tx.description}>{tx.description}</p>
                    <p className="text-xs text-navy-500 flex items-center gap-1 mt-0.5 truncate">
                      📅 {tx.date.split('-').reverse().join('/')} • <span className="uppercase text-[10px] font-bold bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded tracking-wide shrink-0">{categoryLabels[tx.category] || tx.category}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={cn(
                    "font-heading font-bold text-md whitespace-nowrap",
                    tx.type === 'INCOME' ? "text-green-600" : "text-red-600"
                  )}>
                    {tx.type === 'INCOME' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                  </span>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === tx.id ? null : tx.id);
                      }}
                      className="text-navy-400 hover:text-navy-600 p-2 rounded-xl border border-transparent hover:border-navy-100 hover:bg-white transition-all"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {menuOpenId === tx.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpenId(null)}
                        ></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-navy-100 z-20 py-2 animate-in fade-in zoom-in duration-200 origin-top-right">
                          <button
                            onClick={() => handleEdit(tx)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4 text-navy-400" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setTransactionToDelete(tx.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal Novo/Editar Lançamento */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Editar Lançamento" : "Novo Lançamento"}>
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">Tipo de Movimentação</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('EXPENSE')}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold border transition-all relative overflow-hidden",
                  type === 'EXPENSE'
                    ? "bg-red-50 text-red-700 border-red-200 shadow-sm ring-2 ring-red-500/10"
                    : "bg-white border-navy-200 text-navy-500 hover:bg-navy-50"
                )}
              >
                💸 Despesa
              </button>
              <button
                type="button"
                onClick={() => setType('INCOME')}
                className={cn(
                  "flex-1 py-3 rounded-xl font-bold border transition-all relative overflow-hidden",
                  type === 'INCOME'
                    ? "bg-green-50 text-green-700 border-green-200 shadow-sm ring-2 ring-green-500/10"
                    : "bg-white border-navy-200 text-navy-500 hover:bg-navy-50"
                )}
              >
                💰 Receita
              </button>
            </div>
          </div>

          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder={type === 'EXPENSE' ? "Ex: Compra de bolas" : "Ex: Venda de rifas"}
          />

          <CurrencyInput
            label="Valor"
            value={amount}
            onChange={setAmount}
            required
            placeholder="0,00"
          />

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1">Categoria</label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
              >
                {availableCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-navy-500">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Conditional Input for Other */}
          {category === 'OTHER' && (
            <div className="bg-navy-50 p-3 rounded-xl border border-navy-100 animate-fade-in">
              <label className="block text-xs font-bold text-navy-500 mb-1 uppercase tracking-wide">Detalhes (Opcional)</label>
              <input
                type="text"
                value={otherDescription}
                onChange={e => setOtherDescription(e.target.value)}
                className="w-full bg-white border border-navy-200 rounded-lg p-2 text-sm text-navy-900 focus:ring-2 focus:ring-navy-200 outline-none transition-all"
                placeholder="Especifique..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1">Data</label>
            <DateInput
              value={transactionDate}
              onChange={(v) => setTransactionDate(v)}
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1" isLoading={isSaving} disabled={isSaving}>
              {editingId ? 'Salvar Alterações' : 'Salvar Lançamento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Mensalistas */}
      <Modal
        isOpen={isMonthlyModalOpen}
        onClose={() => setIsMonthlyModalOpen(false)}
        title={`Mensalidades: ${currentMonthName}`}
        width="md"
      >
        <div className="flex flex-col h-full max-h-[70vh]">
          <div className="mb-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1">Período de Referência</p>
              <p className="text-sm text-indigo-600">Selecione para ver status de pagamento.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-200 outline-none"
              >
                <option value={1}>Janeiro</option>
                <option value={2}>Fevereiro</option>
                <option value={3}>Março</option>
                <option value={4}>Abril</option>
                <option value={5}>Maio</option>
                <option value={6}>Junho</option>
                <option value={7}>Julho</option>
                <option value={8}>Agosto</option>
                <option value={9}>Setembro</option>
                <option value={10}>Outubro</option>
                <option value={11}>Novembro</option>
                <option value={12}>Dezembro</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-200 outline-none"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 pr-1 space-y-2">
            {monthlyCandidates.length === 0 ? (
              <div className="py-12 text-center text-navy-400 border-2 border-dashed border-navy-100 rounded-xl">
                <p>Nenhum jogador cadastrado.</p>
              </div>
            ) : (
              monthlyCandidates.map(p => {
                const alreadyPaid = hasPaidSelectedMonth(p.id);
                return (
                  <div key={p.id} className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-xl border border-navy-100 hover:border-brand-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3 w-full sm:w-auto mb-2 sm:mb-0">
                      {p.avatar && !p.avatar.includes('ui-avatars.com') ? (
                        <img src={p.avatar} className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" alt="Avatar" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white border border-white shadow-sm font-bold text-sm bg-green-500">
                          M
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-navy-900 block leading-tight">{p.nickname || p.name}</span>
                        {p.nickname && p.nickname !== p.name && (
                          <span className="text-[10px] text-navy-400 block leading-tight mb-0.5">{p.name}</span>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 rounded uppercase tracking-wider">Mensalista</span>
                          {p.monthlyStartMonth && (
                            <span className="text-[10px] text-navy-400">Desde: {p.monthlyStartMonth.split('-').reverse().join('/')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      disabled={processingId === p.id || successId === p.id || alreadyPaid}
                      onClick={() => handlePayMonthlyFee(p)}
                      variant={alreadyPaid ? "ghost" : "primary"}
                      className={cn(
                        "w-full sm:w-auto min-w-[120px]",
                        alreadyPaid && "bg-green-50 text-green-700 hover:bg-green-100 cursor-default opacity-100"
                      )}
                    >
                      {processingId === p.id ? (
                        <span className="animate-spin">⌛</span>
                      ) : successId === p.id ? (
                        <span>✅ Salvo!</span>
                      ) : alreadyPaid ? (
                        <span className="flex items-center gap-1">✅ Pago</span>
                      ) : (
                        <span>Receber</span>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!transactionToDelete} onClose={() => setTransactionToDelete(null)} title="Excluir Lançamento">
        <p className="text-navy-600 mb-6">
          Tem certeza que deseja apagar este registro? O saldo em caixa será recalculado.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setTransactionToDelete(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete} className="flex-1">Sim, Excluir</Button>
        </div>
      </Modal>

      {/* Status Feedback Modal */}
      <Modal
        isOpen={statusModal.show}
        onClose={() => setStatusModal(prev => ({ ...prev, show: false }))}
        title={statusModal.title}
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg animate-in zoom-in duration-300",
            statusModal.type === 'success' ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
          )}>
            {statusModal.type === 'success' ? '✅' : '❌'}
          </div>
          <div className="space-y-2">
            <p className="text-navy-700 font-medium leading-relaxed">
              {statusModal.message}
            </p>
          </div>
          <Button
            className="w-full mt-4"
            onClick={() => setStatusModal(prev => ({ ...prev, show: false }))}
          >
            Entendido
          </Button>
        </div>
      </Modal>
    </div>
  );
};
