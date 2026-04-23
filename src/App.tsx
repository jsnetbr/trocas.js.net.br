import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Calendar, RotateCcw, Share2, Camera, ThumbsUp, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toBlob } from 'html-to-image';
import { KpiCard } from './components/KpiCard';
import { DepartmentTable } from './components/DepartmentTable';
import { departmentData as initialData } from './data';
import { db } from './lib/firebase';
import { collection, doc, onSnapshot, setDoc, writeBatch, query, getDocs } from 'firebase/firestore';
import { DepartmentData } from './types';

export default function App() {
  const { user, loading, signIn } = useAuth();
  const [data, setData] = useState<DepartmentData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const captureRef = useRef<HTMLDivElement>(null);

  // Single Sync Effect: Handles auth-based data synchronization
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setData([]);
      return;
    }

    setIsLoading(true);
    
    // 1. References
    const masterSectorsRef = collection(db, 'config', 'master_sectors', 'sectors');
    const dailySectorsRef = collection(db, 'reports', currentDate, 'sectors');

    let masterList: any[] = [];
    let dailyList: any[] = [];

    const combineData = () => {
      // Use initialData as the skeleton for names and IDs
      const combined = initialData.map(base => {
        const master = masterList.find(m => m.id === base.id);
        const daily = dailyList.find(d => d.id === base.id);
        
        const meta = master?.meta ?? base.meta;
        const realizado = daily?.realizado ?? 0;
        
        // Logical change: Status is now variation % from meta
        // ((Realizado - Meta) / Meta) * 100
        const status = meta > 0 ? ((realizado - meta) / meta) * 100 : 0;
        
        return {
          ...base,
          meta,
          realizado,
          status,
          updatedAt: daily?.updatedAt || master?.updatedAt || new Date().toISOString()
        };
      });
      setData(combined);
      setIsLoading(false);
    };

    // 2. Listen to Master Metas
    const unsubMaster = onSnapshot(masterSectorsRef, (snapshot) => {
      if (snapshot.empty) {
        // First time initialization of Master Metas
        const batch = writeBatch(db);
        initialData.forEach(item => {
          const docRef = doc(masterSectorsRef, item.id);
          batch.set(docRef, { id: item.id, setor: item.setor, meta: item.meta });
        });
        batch.commit();
      } else {
        masterList = snapshot.docs.map(doc => doc.data());
        combineData();
      }
    });

    // 3. Listen to Daily Realizados
    const unsubDaily = onSnapshot(dailySectorsRef, (snapshot) => {
      dailyList = snapshot.docs.map(doc => doc.data());
      combineData();
    });

    return () => {
      unsubMaster();
      unsubDaily();
    };
  }, [currentDate, user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="glass w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl mb-6 shadow-lg shadow-cyan-500/20 flex items-center justify-center animate-pulse">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Acesso ao Relatório</h1>
          <p className="text-white/60 mb-8 text-sm">Faça login para continuar</p>
          <button 
            onClick={signIn}
            className="w-full bg-white hover:bg-white/90 text-slate-950 px-6 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  };

  const handleUpdate = async (id: string, updates: Partial<DepartmentData>) => {
    try {
      if (updates.meta !== undefined) {
        // Update Global Meta
        const masterDocRef = doc(db, 'config', 'master_sectors', 'sectors', id);
        await setDoc(masterDocRef, { meta: updates.meta }, { merge: true });
      }
      
      if (updates.realizado !== undefined) {
        // Update Daily Realizado
        const dailyDocRef = doc(db, 'reports', currentDate, 'sectors', id);
        await setDoc(dailyDocRef, { 
          id, 
          realizado: updates.realizado, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      }
      
      triggerToast('Dados sincronizados!');
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleReset = async () => {
    const batch = writeBatch(db);
    data.forEach((item) => {
      const docRef = doc(db, 'reports', currentDate, 'sectors', item.id);
      batch.set(docRef, { id: item.id, realizado: 0, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
    triggerToast('Valores zerados para este dia!');
  };

  const triggerToast = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleShareScreenshot = async () => {
    if (!captureRef.current) return;
    setIsLoading(true);
    triggerToast('Gerando imagem...');
    
    try {
      const filterNodes = (node: HTMLElement) => {
        return !node.classList?.contains('no-capture');
      };

      const blob = await toBlob(captureRef.current, {
        backgroundColor: '#020617', // slate-950
        pixelRatio: 2,
        filter: filterNodes,
      });
      
      if (!blob) {
        triggerToast('Erro ao gerar imagem.');
        setIsLoading(false);
        return;
      }

      const file = new File([blob], `relatorio_trocas_${currentDate}.png`, { type: 'image/png' });

      // Tenta usar a Web Share API (Natividade no mobile para WhatsApp)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Relatório Diário de Trocas',
            text: `Relatório do dia ${currentDate}`,
          });
          triggerToast('Compartilhado com sucesso!');
        } catch (e) {
          console.log('Compartilhamento cancelado', e);
        }
      } else {
        // Fallback para download na web onde o share nativo não funciona
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_trocas_${currentDate}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        triggerToast('Imagem salva para enviar pelo WhatsApp!');
      }
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      triggerToast('Erro ao capturar tela.');
      setIsLoading(false);
    }
  };

  // Calculate totals
  const totalRealized = data.reduce((acc, curr) => acc + curr.realizado, 0);
  const totalGoal = data.reduce((acc, curr) => acc + curr.meta, 0);
  const totalVariance = totalRealized - totalGoal;
  const variancePercentage = totalGoal > 0 ? (totalVariance / totalGoal) * 100 : 0;

  const bestSector = data.length > 0 ? [...data].sort((a, b) => a.status - b.status)[0] : null;
  const worstSector = data.length > 0 ? [...data].sort((a, b) => b.status - a.status)[0] : null;

  return (
    <div ref={captureRef} className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 text-white relative bg-slate-950">
      <div className="bg-blur" />
      
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 glass px-6 py-3 rounded-full flex items-center gap-3 border-white/20 shadow-2xl no-capture"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium">{showToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 relative z-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-sm">
            Relatório de Trocas Diário
          </h1>
          {isLoading && (
            <div className="flex items-center gap-2 mt-2 text-white/40 text-xs text-cyan-400 no-capture">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sincronizando...
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 no-capture">
          <div className="glass rounded-lg px-3 py-2 flex items-center gap-3 shadow-sm border-white/10 group cursor-pointer hover:bg-white/15 transition-colors relative">
            <Calendar className="w-4 h-4 text-white/60 group-hover:text-white transition-colors pointer-events-none" />
            <input 
              type="date" 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-white/80 focus:ring-0 w-32 cursor-pointer outline-none [color-scheme:dark]"
            />
          </div>

          <button 
            onClick={handleReset}
            disabled={isLoading}
            className="bg-white/10 hover:bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-white/10 backdrop-blur-md disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Zerar Realizados
          </button>

          <button 
            onClick={handleShareScreenshot}
            disabled={isLoading}
            className="bg-[#25D366] hover:bg-[#20b858] text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-white/20 backdrop-blur-md disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Capturar P/ WhatsApp
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <KpiCard title="Total Realizado" value={formatCurrency(totalRealized)} delay={0.1} />
        <KpiCard title="Meta Total" value={formatCurrency(totalGoal)} delay={0.2} />
        <KpiCard 
          title="Variação Total" 
          value={formatCurrency(totalVariance)} 
          subtitle={`${formatPercentage(variancePercentage)} ${totalVariance >= 0 ? 'acima' : 'abaixo'} da meta`}
          type="variance"
          delay={0.3}
        />
        
        <KpiCard title="Insights" value="" type="insight" delay={0.4}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <ThumbsUp className="w-4 h-4 text-green-300" />
              <div>
                <p className="text-xs font-semibold text-white/90">Melhor: {bestSector?.setor || '-'}</p>
                <p className="text-[10px] text-white/40">Status: {formatPercentage(bestSector?.status || 0)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-300" />
              <div>
                <p className="text-xs font-semibold text-white/90">Pior: {worstSector?.setor || '-'}</p>
                <p className="text-[10px] text-white/40">Status: {formatPercentage(worstSector?.status || 0)}</p>
              </div>
            </div>
          </div>
        </KpiCard>
      </div>

      <div className="relative z-10">
        <DepartmentTable data={data} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}

