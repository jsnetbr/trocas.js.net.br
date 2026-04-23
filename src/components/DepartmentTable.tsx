import React from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, ThumbsUp, AlertCircle } from 'lucide-react';
import { DepartmentData } from '../types';

interface DepartmentTableProps {
  data: DepartmentData[];
  onUpdate: (id: string, updates: Partial<DepartmentData>) => void;
}

export const DepartmentTable: React.FC<DepartmentTableProps> = ({ data, onUpdate }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  };

  const handleInputChange = (id: string, field: keyof DepartmentData, value: string) => {
    // Remove dots (thousand separators) and replace comma with dot (decimal separator)
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const numValue = parseFloat(normalized) || 0;
    onUpdate(id, { [field]: numValue });
  };

  const bestSector = data.length > 0 ? [...data].sort((a, b) => a.status - b.status)[0] : null;
  const worstSector = data.length > 0 ? [...data].sort((a, b) => b.status - a.status)[0] : null;

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden mx-1">
      <div className="px-4 py-2 border-b border-white/10">
        <h2 className="text-white font-semibold text-xs md:text-sm">Detalhes por Departamento</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[400px]">
          <thead>
            <tr className="bg-white/5 text-white/50 text-[9px] md:text-[10px] uppercase font-medium">
              <th className="px-2 py-1.5 md:px-3 text-left">Setor</th>
              <th className="px-2 py-1.5 md:px-3 text-right">Realizado</th>
              <th className="px-2 py-1.5 md:px-3 text-right">Meta</th>
              <th className="px-2 py-1.5 md:px-3 text-right">Diferença</th>
              <th className="px-2 py-1.5 md:px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((item, index) => {
              const diff = item.realizado - item.meta;
              const isPositive = diff > 0;
              // status > 0 means we are ABOVE the limit (Bad for Trocas)
              const isAboveMeta = item.status > 0;
              const isBelowMeta = item.status < 0;
              const isBest = item.id === bestSector?.id;
              const isWorst = item.id === worstSector?.id;

              return (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-white/5 transition-colors"
                >
                  <td className="px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium text-white/80 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] sm:max-w-none" title={item.setor}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{item.setor}</span>
                      {isBest && <ThumbsUp className="w-3 h-3 text-green-400 shrink-0" />}
                      {isWorst && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-2 md:px-3 py-1.5 text-[11px] md:text-xs text-right tabular-nums group/cell">
                    <div className="relative inline-block">
                      <input
                        key={`${item.id}-realizado-${item.realizado}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={item.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        onBlur={(e) => handleInputChange(item.id, 'realizado', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-cyan-400 outline-none text-right text-white/60 focus:text-white w-14 sm:w-20 px-0.5 py-0 transition-all text-[11px] md:text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-2 md:px-3 py-1.5 text-[11px] md:text-xs text-right tabular-nums group/cell">
                    <div className="relative inline-block">
                      <input
                        key={`${item.id}-meta-${item.meta}`}
                        type="text"
                        inputMode="decimal"
                        defaultValue={item.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        onBlur={(e) => handleInputChange(item.id, 'meta', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-cyan-400 outline-none text-right text-white/60 focus:text-white w-14 sm:w-20 px-0.5 py-0 transition-all text-[11px] md:text-xs"
                      />
                    </div>
                  </td>
                  <td className={`px-2 md:px-3 py-1.5 text-right tabular-nums font-medium`}>
                    <div className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] md:text-[11px] ${
                      isPositive ? 'bg-red-400/20 text-red-300' : 'bg-green-400/20 text-green-300'
                    }`}>
                      {formatCurrency(Math.abs(diff))}
                      {isPositive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                    </div>
                  </td>
                  <td className="px-2 md:px-3 py-1.5 text-right">
                    <div className={`inline-flex flex-col items-end gap-0 min-w-[50px] md:min-w-[70px]`}>
                      <div className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[10px] md:text-[11px] font-semibold tabular-nums leading-none ${
                         isAboveMeta ? 'bg-red-400/20 text-red-300' : 
                         isBelowMeta ? 'bg-green-400/20 text-green-300' : 
                         'bg-white/10 text-white/40'
                      }`}>
                        {formatPercentage(Math.abs(item.status))}
                        {isAboveMeta ? <ArrowUp className="w-2.5 h-2.5" /> : isBelowMeta ? <ArrowDown className="w-2.5 h-2.5" /> : null}
                      </div>
                      <span className={`text-[8px] uppercase font-bold tracking-wider leading-none mt-0.5 ${
                        isAboveMeta ? 'text-red-400/60' : isBelowMeta ? 'text-green-400/60' : 'text-white/20'
                      }`}>
                        {isAboveMeta ? 'acima' : isBelowMeta ? 'abaixo' : 'meta'}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
