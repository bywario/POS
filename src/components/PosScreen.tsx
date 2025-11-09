import React, { useState } from 'react';
import { AppConfig, MesaData, Venta } from '../types';
import { BanknotesIcon, BarChartIcon, Cog6ToothIcon, DocumentDuplicateIcon, SparklesIcon, TableCellsIcon, ClipboardDocumentListIcon } from './icons/Icons';
import MesaCard from './MesaCard';
import CobroModal from './CobroModal';
import StatsModal from './StatsModal';
import { printComanda, openCashDrawer } from '../services/printerService';

interface PosScreenProps {
  config: AppConfig;
  comandasData: MesaData[];
  ventasHistory: Venta[];
  isSyncing: boolean;
  onNavigateToConfig: () => void;
  onConfirmCobro: (mesa: MesaData, itemsToPay: any[], paymentMethod: string, divisionType: string, numPersonas: number) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  onCloseShift: () => void;
}

const PosScreen: React.FC<PosScreenProps> = ({ 
    config, comandasData, ventasHistory, isSyncing, 
    onNavigateToConfig, onConfirmCobro, showToast, onCloseShift 
}) => {
  const [selectedMesa, setSelectedMesa] = useState<MesaData | null>(null);
  const [isCobroModalOpen, setIsCobroModalOpen] = useState(false);
  const [mesaToPay, setMesaToPay] = useState<MesaData | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleCobrarClick = (mesa: MesaData) => {
    setMesaToPay(mesa);
    setIsCobroModalOpen(true);
  };
  
  const handleSelectMesa = (mesa: MesaData) => {
    if (selectedMesa?.mesa === mesa.mesa) {
        setSelectedMesa(null);
    } else {
        setSelectedMesa(mesa);
    }
  };

  const handlePrintOrder = async () => {
    if (!selectedMesa) {
        showToast('Por favor, seleccione una mesa para imprimir.', 'error');
        return;
    }
    showToast('Imprimiendo comanda seleccionada...', 'success');
    try {
        await printComanda(config, selectedMesa, selectedMesa.items, null, 'completa', 1);
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        showToast(errorMessage, 'error');
    }
  };
  
  const handleOpenDrawer = async () => {
    showToast('Enviando pulso para abrir cajón...', 'success');
    try {
      await openCashDrawer(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      showToast(errorMessage, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Punto de Venta</h1>
        <div className={`flex items-center text-sm font-semibold transition-opacity duration-300 ${isSyncing ? 'opacity-0' : 'opacity-100'}`}>
            <SparklesIcon className="w-5 h-5 mr-2 text-green-500 pulse-animation" />
            <span className="text-green-600">Sincronización en tiempo real activa</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
           <div className="flex flex-wrap items-center gap-2">
              <button onClick={handlePrintOrder} disabled={!selectedMesa} className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50">
                <DocumentDuplicateIcon className="w-5 h-5 mr-2" /> Imprimir Comanda
              </button>
               <button onClick={handleOpenDrawer} className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                 <BanknotesIcon className="w-5 h-5 mr-2" /> Abrir Cajón
               </button>
           </div>
           <div className="flex flex-wrap items-center gap-2">
               <button onClick={() => setIsStatsModalOpen(true)} className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm">
                <BarChartIcon className="w-5 h-5 mr-2" /> Estadísticas
              </button>
              <button onClick={onCloseShift} className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-semibold">
                <ClipboardDocumentListIcon className="w-5 h-5 mr-2" /> Cerrar Turno
              </button>
              <button onClick={onNavigateToConfig} className="flex items-center px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm">
                <Cog6ToothIcon className="w-5 h-5 mr-2" /> Configuración
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {comandasData.map((mesa) => (
          <MesaCard key={mesa.mesa} mesaData={mesa} onCobrarClick={handleCobrarClick} isSelected={selectedMesa?.mesa === mesa.mesa} onSelect={handleSelectMesa} />
        ))}
      </div>

      {comandasData.length === 0 && !isSyncing && (
        <div className="text-center py-16 bg-white rounded-2xl card-shadow">
            <TableCellsIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">Todo en orden</h3>
            <p className="text-gray-500 mt-2">No hay comandas activas en este momento.</p>
        </div>
      )}
      
      {isSyncing && comandasData.length === 0 && (
         <div className="text-center py-16 bg-white rounded-2xl card-shadow">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
             <p className="text-gray-500 mt-4">Sincronizando comandas...</p>
         </div>
      )}


      {isCobroModalOpen && mesaToPay && (
        <CobroModal 
            isOpen={isCobroModalOpen} 
            onClose={() => setIsCobroModalOpen(false)} 
            mesaData={mesaToPay} 
            onConfirm={onConfirmCobro}
            config={config}
            showToast={showToast}
        />
      )}
      
      {isStatsModalOpen && (
          <StatsModal
            isOpen={isStatsModalOpen}
            onClose={() => setIsStatsModalOpen(false)}
            ventasHistory={ventasHistory}
            config={config}
            showToast={showToast}
          />
      )}
    </div>
  );
};

export default PosScreen;
