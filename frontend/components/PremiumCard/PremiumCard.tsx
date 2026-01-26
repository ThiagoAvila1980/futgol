import React from 'react';

interface PremiumCardProps {
  title?: string;
  className?: string;
}

const PremiumCard: React.FC<PremiumCardProps> = ({ title, className = "" }) => {
  return (
    <div className={`p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${className}`}>
      <h2 className="text-xl font-bold text-white mb-2">{title || "Premium Component"}</h2>
      <p className="text-gray-300 text-sm italic">
        Criado com a Skill Premium UI Component do Futgol.
      </p>
    </div>
  );
};

export default PremiumCard;
