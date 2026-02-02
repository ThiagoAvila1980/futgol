import React, { useState, useEffect } from 'react';
import { Match, Player, User } from '../types';
import { Button } from './ui/Button';

interface MatchVoteCardProps {
  match: Match;
  currentUser: User;
  currentPlayer?: Player;
  players: Player[];
}

export const MatchVoteCard: React.FC<MatchVoteCardProps> = ({ match, currentUser, currentPlayer, players }) => {
  const [votes, setVotes] = useState<any[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedForId, setVotedForId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Identify the voter
  const myId = currentPlayer?.id || currentUser.id;
  const arrivedIds = match.arrivedPlayerIds || [];

  // Check if current user was present
  const isPresent = arrivedIds.includes(myId);

  useEffect(() => {
    if (isPresent) {
      loadVotes();
    }
  }, [match.id, isPresent]);

  const loadVotes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/matches/${match.id}/votes`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.votes) {
        setVotes(data.votes);
        const myVote = data.votes.find((v: any) => v.voterId === myId);
        if (myVote) {
          setHasVoted(true);
          setVotedForId(myVote.votedForId);
        }
      }
    } catch (error) {
      console.error('Error loading votes', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidateId || isSending) return;

    try {
      setIsSending(true);
      const res = await fetch(`/api/matches/${match.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: myId, votedForId: selectedCandidateId })
      });

      if (res.ok) {
        setHasVoted(true);
        setVotedForId(selectedCandidateId);
        await loadVotes();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao votar');
      }
    } catch (e) {
      alert('Erro ao votar');
    } finally {
      setIsSending(false);
    }
  };

  if (!isPresent) return null;

  // Filter candidates: only players who were present can be voted for
  const candidates = players
    .filter(p => arrivedIds.includes(p.id))
    .sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-4 pt-4 border-t border-navy-100"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[12px] font-black text-black-400 uppercase tracking-widest">
          🗳️ Votação do Craque
        </h4>
        {(hasVoted && !match.mvpId) && (
          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
            Voto confirmado
          </span>
        )}
      </div>

      {(() => {
        if (match.mvpId) {
          const mvp = players.find(p => p.id === match.mvpId);
          return (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 animate-fade-in shadow-sm">
              <span className="text-xl">🏆</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Craque da Galera</span>
                <span className="text-sm font-black text-amber-900">
                  {mvp?.nickname || mvp?.name || 'Desconhecido'}
                </span>
              </div>
            </div>
          );
        }

        if (hasVoted) {
          return (
            <div className="flex items-center gap-2 p-2 bg-navy-50 rounded-lg border border-navy-100">
              <span className="text-lg">🎯</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-navy-400 font-bold uppercase">Seu voto</span>
                <span className="text-sm font-bold text-navy-800">
                  {players.find(p => p.id === votedForId)?.nickname || players.find(p => p.id === votedForId)?.name || 'Desconhecido'}
                </span>
              </div>
            </div>
          );
        }

        const matchDate = new Date(`${match.date}T${match.time || '00:00:00'}`);
        const now = new Date();
        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        const isVotingClosed = now.getTime() - matchDate.getTime() > twoDaysInMs;

        if (isVotingClosed) {
          return (
            <div className="text-[10px] font-bold text-navy-400 italic py-1">
              Votação encerrada para esta partida.
            </div>
          );
        }

        return (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="w-full sm:flex-1 bg-white border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-800 font-bold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none cursor-pointer"
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
            >
              <option value="">Selecione o melhor jogador...</option>
              {candidates.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nickname || p.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleVote}
              isLoading={isSending}
              disabled={!selectedCandidateId}
              className="shrink-0 w-full sm:w-auto"
            >
              Votar
            </Button>
          </div>
        );
      })()}
    </div>
  );
};
