
param (
    [string]$ComponentName
)

if (-not $ComponentName) {
    Write-Host "Por favor, forneça o nome do componente." -ForegroundColor Red
    exit 1
}

$TargetDir = "c:\dev\futgol\frontend\components\$ComponentName"
if (Test-Path $TargetDir) {
    Write-Host "Componente $ComponentName já existe!" -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Path $TargetDir -Force

$Content = @'
import React from 'react';

interface ComponentProps {
  title?: string;
  className?: string;
}

const COMPONENT_NAME: React.FC<ComponentProps> = ({ title, className = "" }) => {
  return (
    <div className={`p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${className}`}>
      <h2 className="text-xl font-bold text-white mb-2">{title || "Premium Component"}</h2>
      <p className="text-gray-300 text-sm italic">
        Criado com a Skill Premium UI Component do Futgol.
      </p>
    </div>
  );
};

export default COMPONENT_NAME;
'@

# Replace placeholders
$Content = $Content.Replace("COMPONENT_NAME", $ComponentName)
$Content = $Content.Replace("ComponentProps", $ComponentName + "Props")

$Content | Out-File -FilePath "$TargetDir\$ComponentName.tsx" -Encoding utf8

Write-Host "Componente $ComponentName criado com sucesso em $TargetDir" -ForegroundColor Green
