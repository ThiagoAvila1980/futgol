import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { User, Group } from '../types';
import api from '../services/api';
import { cn } from '../lib/utils';
import { CalendarDays, Clock, MapPin, Search, X } from 'lucide-react';

interface MarketplaceScreenProps {
  currentUser: User;
  activeGroup?: Group | null;
  onBooked?: (params: { fieldId: string; date: string; startTime: string; endTime: string; bookingId: string }) => void;
  onClose?: () => void;
}

interface MarketplaceField {
  id: string;
  name: string;
  type: string;
  location: string;
  city: string;
  hourlyRate: number;
  coordinates: { lat: number; lng: number } | null;
  description: string;
  photos: string[];
  venueName: string;
  venueAddress: string;
  avgRating: string;
  reviewCount: number;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
}

interface AvailabilitySlot {
  id: string;
  fieldId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  price: number | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  playerName: string;
  playerAvatar: string;
}

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ currentUser, activeGroup, onBooked, onClose }) => {
  const [fields, setFields] = useState<MarketplaceField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [selectedField, setSelectedField] = useState<MarketplaceField | null>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [filterType, setFilterType] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    searchFields();
  }, []);

  const searchFields = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchName) params.set('name', searchName);
      if (searchCity) params.set('city', searchCity);
      if (filterType) params.set('type', filterType);
      if (availabilityDate) params.set('date', availabilityDate);
      const query = params.toString();
      const data = await api.get(`/api/marketplace/search${query ? `?${query}` : ''}`);
      setFields(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (fieldId: string) => {
    if (!availabilityDate) return;
    setSlotsLoading(true);
    setSelectedSlotId(null);
    try {
      const params = new URLSearchParams({ fieldId, date: availabilityDate });
      const data: AvailabilitySlot[] = await api.get(`/api/marketplace/availability?${params.toString()}`);
      setSlots(data);
    } catch (error) {
      console.error('Availability error:', error);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadReviews = async (fieldId: string) => {
    try {
      const data = await api.get(`/api/marketplace/reviews/${fieldId}`);
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Reviews error:', error);
    }
  };

  const handleBook = async () => {
    if (!selectedField || !selectedSlotId || !availabilityDate) return;
    const slot = slots.find(s => s.id === selectedSlotId);
    if (!slot) return;

    // startTime / endTime no backend são HH:mm, mas aqui temos ISO-like.
    const startTime = slot.startTime.slice(11, 16);
    const endTime = slot.endTime.slice(11, 16);

    try {
      const booking = await api.post('/api/marketplace/book', {
        fieldId: selectedField.id,
        groupId: activeGroup?.id,
        bookedBy: currentUser.id,
        date: availabilityDate,
        startTime,
        endTime,
        slotId: slot.id,
      });

      if (onBooked) {
        onBooked({
          fieldId: selectedField.id,
          date: availabilityDate,
          startTime,
          endTime,
          bookingId: booking.id,
        });
      } else {
        alert('Reserva confirmada!');
      }

      // Atualiza disponibilidade local removendo o slot reservado
      setSlots(prev => prev.filter(s => s.id !== slot.id));
      setSelectedSlotId(null);
    } catch (error: any) {
      alert(error.message?.includes('409') ? 'Horário já reservado!' : 'Erro ao reservar');
    }
  };

  const handleReview = async () => {
    if (!selectedField) return;
    try {
      await api.post(`/api/marketplace/reviews/${selectedField.id}`, {
        playerId: currentUser.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      setReviewForm({ rating: 5, comment: '' });
      loadReviews(selectedField.id);
    } catch (error) {
      console.error('Review error:', error);
    }
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(Math.round(Number(rating)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
              <Input
                placeholder="Buscar por nome do campo..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
              <Input
                placeholder="Buscar por Cidade..."
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-navy-200 text-xs md:text-sm bg-white font-medium text-navy-800"
            >
              <option value="">Todos os tipos</option>
              <option value="society">Society</option>
              <option value="quadra">Quadra</option>
              <option value="profissional">Profissional</option>
            </select>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
              <Input
                type="date"
                value={availabilityDate}
                onChange={(e) => setAvailabilityDate(e.target.value)}
                className="pl-9 text-xs md:text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex md:flex-col gap-2 md:w-40">
          <Button
            onClick={searchFields}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
          
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-navy-500">Buscando quadras...</div>
      ) : fields.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🏟️</div>
          <h3 className="text-lg font-bold text-navy-900">Nenhuma quadra encontrada</h3>
          <p className="text-navy-500 mt-1">Tente alterar os filtros de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field) => (
            <Card key={field.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {
              setSelectedField(field);
              loadAvailability(field.id);
              loadReviews(field.id);
            }}>
              <div className="h-32 bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center">
                {field.photos?.[0] ? (
                  <img src={field.photos[0]} alt={field.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">🏟️</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-navy-900 text-sm">{field.name}</h3>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {field.type || 'N/A'}
                  </Badge>
                </div>
                {field.city && (
                  <p className="text-xs text-navy-500 mt-1">📍 {field.city}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span>{renderStars(Number(field.avgRating))}</span>
                    <span className="text-navy-400">({field.reviewCount})</span>
                  </div>
                  <span className="font-bold text-brand-600 text-sm">
                    R$ {field.hourlyRate?.toFixed(0)}/h
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedField && !showReviews && (
        <Modal
          isOpen
          onClose={() => {
            setSelectedField(null);
            setSlots([]);
            setSelectedSlotId(null);
            onClose && onClose();
          }}
          title="Detalhes do Campo e Horários Disponíveis"
          width="xl"
        >
          <div className="space-y-6">
            {/* Cabeçalho do campo */}
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex-1">
                <h3 className="text-2xl font-heading font-bold text-navy-900">
                  {selectedField.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-navy-600">
                  {selectedField.venueName && (
                    <span className="flex items-center gap-1">
                      <span className="text-xs">🏢</span>
                      {selectedField.venueName}
                    </span>
                  )}
                  {selectedField.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-brand-600" />
                      {selectedField.city}
                    </span>
                  )}
                  {selectedField.type && (
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedField.type}
                    </Badge>
                  )}
                </div>
                {selectedField.description && (
                  <p className="text-sm text-navy-600 mt-2">
                    {selectedField.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <span className="text-lg">
                      {renderStars(Number(selectedField.avgRating))}
                    </span>
                    <span className="text-xs text-navy-500">
                      ({selectedField.reviewCount} avaliações)
                    </span>
                  </div>
                  <div className="text-xl font-black text-brand-600">
                    R$ {selectedField.hourlyRate?.toFixed(2)}/hora
                  </div>
                </div>
                {selectedField.contactPhone && (
                  <p className="text-xs text-navy-500 mt-1">
                    📞 {selectedField.contactPhone}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 w-full md:w-60">
                <div className="flex items-center gap-2 text-xs text-navy-500 bg-navy-50 border border-navy-100 rounded-xl px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-brand-600" />
                  <span className="font-bold">
                    Disponibilidade para o dia{' '}
                    {availabilityDate
                      ? new Date(availabilityDate + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '-'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviews(true)}
                  className="w-full text-xs font-bold"
                >
                  Ver avaliações
                </Button>
              </div>
            </div>

            {/* Grid de horários */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-navy-900 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-600" />
                  Horários disponíveis
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => selectedField && loadAvailability(selectedField.id)}
                  className="text-xs"
                >
                  Atualizar
                </Button>
              </div>

              {slotsLoading ? (
                <div className="py-8 text-center text-sm text-navy-500">
                  Carregando horários disponíveis...
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-sm text-navy-500 border border-dashed border-navy-100 rounded-2xl bg-navy-50/40">
                  Nenhum horário disponível para o dia selecionado.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map((slot) => {
                    const isSelected = slot.id === selectedSlotId;
                    const startLabel = slot.startTime.slice(11, 16);
                    const endLabel = slot.endTime.slice(11, 16);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-2xl border-2 px-3 py-2 text-xs font-bold transition-all shadow-sm',
                          isSelected
                            ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-brand-500/10'
                            : 'border-navy-100 bg-white text-navy-800 hover:border-brand-500 hover:bg-brand-50/40'
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {startLabel} - {endLabel}
                        </span>
                        {slot.price != null && (
                          <span className="mt-1 text-[11px] text-brand-700">
                            R$ {slot.price.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-navy-50">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setSelectedField(null);
                  setSlots([]);
                  setSelectedSlotId(null);
                  onClose && onClose();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!selectedSlotId || slotsLoading}
                onClick={handleBook}
              >
                Confirmar reserva
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showReviews && selectedField && (
        <Modal isOpen onClose={() => setShowReviews(false)}>
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold text-navy-900">Avaliações - {selectedField.name}</h3>
            <button
              type="button"
              onClick={() => setShowReviews(false)}
              className="text-navy-300 hover:text-navy-700 rounded-full p-1 hover:bg-navy-50 transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {reviews.map((review) => (
              <div key={review.id} className="p-3 bg-navy-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-navy-900">{review.playerName}</span>
                  <span className="text-xs">{renderStars(review.rating)}</span>
                </div>
                {review.comment && <p className="text-sm text-navy-600">{review.comment}</p>}
                <span className="text-xs text-navy-400">{new Date(review.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
            {reviews.length === 0 && (
              <p className="text-center text-navy-500 py-4">Nenhuma avaliação ainda</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t space-y-2">
            <h4 className="font-medium text-sm text-navy-900">Deixe sua avaliação</h4>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                  className={cn('text-2xl transition-transform', star <= reviewForm.rating ? 'scale-110' : 'opacity-30')}
                >
                  ⭐
                </button>
              ))}
            </div>
            <Input
              placeholder="Comentário (opcional)"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
            />
            <Button onClick={handleReview} size="sm">Enviar Avaliação</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
