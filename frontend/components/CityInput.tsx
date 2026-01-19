
import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/Input';
import { locationService, City } from '../services/location';

interface CityInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
    icon?: React.ReactNode;
}

export const CityInput: React.FC<CityInputProps> = ({ label, value, onChange, placeholder, required, className, icon }) => {
    const [suggestions, setSuggestions] = useState<City[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allCities, setAllCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(true);
        locationService.getCities().then(cities => {
            setAllCities(cities);
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalize = (str: string) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        onChange(term);

        if (term.length >= 3) {
            const normalizedTerm = normalize(term);
            const filtered = allCities.filter(city =>
                city.nome.toLowerCase().includes(term.toLowerCase()) ||
                (city.normalized && city.normalized.includes(normalizedTerm))
            ).slice(0, 10); // Limit to top 10 results
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectCity = (city: City) => {
        onChange(`${city.nome}, ${city.uf}`);
        setShowSuggestions(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <Input
                label={label}
                value={value}
                onChange={handleInputChange}
                onFocus={() => (value.length >= 3 || isLoading) && setShowSuggestions(true)}
                placeholder={isLoading ? 'Carregando cidades...' : placeholder}
                required={required}
                autoComplete="off"
                icon={icon}
            />
            {showSuggestions && (
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border border-navy-100 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {isLoading ? (
                        <div className="p-4 flex items-center justify-center gap-3 text-navy-400">
                            <div className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full font-medium"></div>
                            <span className="text-sm font-medium">Buscando cidades...</span>
                        </div>
                    ) : suggestions.length > 0 ? (
                        suggestions.map((city, index) => (
                            <button
                                key={`${city.nome}-${city.uf}-${index}`}
                                type="button"
                                className="w-full text-left px-4 py-3 text-sm text-navy-900 hover:bg-brand-50 transition-colors border-b border-navy-50 last:border-0 flex justify-between items-center group"
                                onClick={() => selectCity(city)}
                            >
                                <span className="font-semibold group-hover:text-brand-700 transition-colors">{city.nome}</span>
                                <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-100 uppercase tracking-tighter">
                                    {city.uf}
                                </span>
                            </button>
                        ))
                    ) : value.length >= 3 ? (
                        <div className="p-4 text-center text-navy-400">
                            <p className="text-sm font-medium">Nenhuma cidade encontrada.</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
