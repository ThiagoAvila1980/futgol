
import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import api from '../../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface TeamAutocompleteProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const TeamAutocomplete: React.FC<TeamAutocompleteProps> = ({
    label,
    value,
    onChange,
    placeholder,
    disabled,
    className
}) => {
    const [teams, setTeams] = useState<string[]>([]);
    const [filteredTeams, setFilteredTeams] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get('/api/teams').then((data: any) => {
            if (Array.isArray(data)) {
                setTeams(data);
            }
        }).catch(err => console.error("Error fetching teams", err));
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);

        if (val.trim().length > 0) {
            const filtered = teams.filter(team =>
                team.toLowerCase().includes(val.toLowerCase())
            ).slice(0, 10); // Limit to 10 suggestions
            setFilteredTeams(filtered);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSelect = (team: string) => {
        onChange(team);
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredTeams.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(filteredTeams[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <Input
                label={label}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (value.trim().length > 0) {
                        const filtered = teams.filter(team =>
                            team.toLowerCase().includes(value.toLowerCase())
                        ).slice(0, 10);
                        setFilteredTeams(filtered);
                        setShowSuggestions(true);
                    }
                }}
                placeholder={placeholder}
                disabled={disabled}
                className={className}
                autoComplete="off"
            />
            {showSuggestions && filteredTeams.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-navy-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {filteredTeams.map((team, index) => (
                        <li
                            key={team}
                            className={`px-4 py-2.5 cursor-pointer text-sm font-medium transition-colors ${highlightedIndex === index ? 'bg-brand-50 text-brand-700' : 'text-navy-700 hover:bg-navy-50'
                                }`}
                            onClick={() => handleSelect(team)}
                        >
                            {team}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
