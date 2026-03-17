import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Player } from '../types';
import api from '../services/api';
import { cn } from '../lib/utils';

interface AITeamBalanceProps {
  players: Player[];
  groupId: string;
  onTeamsGenerated?: (teams: any) => void;
}

interface TeamResult {
  name: string;
  players: string[];
  avgRating: number;
  reasoning: string;
}

export const AITeamBalance: React.FC<AITeamBalanceProps> = ({ players, groupId, onTeamsGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ teams: TeamResult[]; analysis: string; aiPowered: boolean } | null>(null);
  const [numTeams, setNumTeams] = useState(2);

  const handleBalance = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/ai/balance', {
        groupId,
        playerIds: players.map(p => p.id),
        numTeams,
      });
      setResult(data);
      onTeamsGenerated?.(data);
    } catch (error) {
      console.error('AI balance error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerById = (id: string) => players.find(p => p.id === id);

  const teamColors = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-yellow-500'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-navy-700">Times:</label>
          <select
            value={numTeams}
            onChange={(e) => setNumTeams(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-navy-200 text-sm bg-white"
          >
            <option value={2}>2 times</option>
            <option value={3}>3 times</option>
            <option value={4}>4 times</option>
          </select>
        </div>
        <Button
          onClick={handleBalance}
          disabled={loading || players.length < numTeams * 2}
          className="gap-2"
        >
          {loading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>🤖</span>
          )}
          {loading ? 'Gerando Times...' : 'Sortear com IA'}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.aiPowered && (
            <div className="flex items-center gap-2 text-xs text-brand-600 font-medium bg-brand-50 px-3 py-1.5 rounded-lg w-fit">
              <span>✨</span> Balanceado por Inteligência Artificial (Gemini)
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.teams.map((team, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('w-3 h-3 rounded-full', teamColors[idx % teamColors.length])} />
                  <h4 className="font-bold text-navy-900">{team.name}</h4>
                  <span className="ml-auto text-xs bg-navy-100 px-2 py-0.5 rounded-full text-navy-600">
                    Rating: {team.avgRating}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {team.players.map((playerId) => {
                    const p = getPlayerById(playerId);
                    return p ? (
                      <div key={playerId} className="flex items-center gap-2 text-sm">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
                          teamColors[idx % teamColors.length]
                        )}>
                          {(p.nickname || p.name).charAt(0)}
                        </div>
                        <span className="font-medium text-navy-800">{p.nickname || p.name}</span>
                        <span className="text-navy-400 text-xs">{p.position}</span>
                        <span className="ml-auto text-xs text-navy-500">⭐ {p.rating}</span>
                      </div>
                    ) : (
                      <div key={playerId} className="text-xs text-navy-400">ID: {playerId}</div>
                    );
                  })}
                </div>
                {team.reasoning && (
                  <p className="mt-2 text-xs text-navy-500 italic border-t pt-2">{team.reasoning}</p>
                )}
              </Card>
            ))}
          </div>

          {result.analysis && (
            <div className="bg-navy-50 rounded-lg p-3 text-sm text-navy-700">
              <strong className="text-navy-900">Análise:</strong> {result.analysis}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
