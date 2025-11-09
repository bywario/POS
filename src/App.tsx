import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppConfig, MesaData, ToastState, Venta } from './types';
import ConfigScreen from './components/ConfigScreen';
import PosScreen from './components/PosScreen';
import Toast from './components/Toast';
import { fetchComandasFromBaserow, markItemsAsPaidInBaserow } from './services/baserowService';
import { printComanda, openCashDrawer, printZReport } from './services/printerService';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [screen, setScreen] = useState<'loading' | 'config' | 'pos'>('loading');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [comandasData, setComandasData] = useState<MesaData[]>([]);
  const [ventasData, setVentasData] = useState<Venta[]>([]); // Ventas del turno actual
  const [ventasHistory, setVentasHistory] = useState<Venta[]>([]); // Historial completo de ventas
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem('posConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig) as AppConfig;
        setConfig(parsedConfig);
        setScreen('pos');
        showToast(`¡Bienvenido de nuevo a ${parsedConfig.empresaNombre || 'POS'}!`, 'success');
      } catch (error) {
        console.error("Falló al analizar la configuración", error);
        setScreen('config');
      }
    } else {
      setScreen('config');
    }

    const savedVentas = localStorage.getItem('posVentas');
    if(savedVentas) {
        try {
            setVentasData(JSON.parse(savedVentas));
        } catch(e) {
            console.error("Falló al analizar los datos de ventas", e);
        }
    }
    
    const savedHistory = localStorage.getItem('posVentasHistory');
    if (savedHistory) {
        try {
            setVentasHistory(JSON.parse(savedHistory));
        } catch(e) {
            console.error("Falló al analizar el historial de ventas", e);
        }
    }

  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    try {
      localStorage.setItem('posConfig', JSON.stringify(newConfig));
      setConfig(newConfig);
      setScreen('pos');
      showToast('¡Configuración guardada exitosamente!', 'success');
    } catch (error) {
      console.error("Error guardando la configuración en localStorage", error);
      showToast('No se pudo guardar la configuración. El almacenamiento podría estar lleno.', 'error');
    }
  };

  const syncComandas = useCallback(async (isInitialSync = false) => {
    if (!config) return;
    if (isInitialSync) setIsSyncing(true);

    try {
      const data = await fetchComandasFromBaserow(config);
      setComandasData(data);
       if (isInitialSync) {
          const totalItems = data.reduce((sum, mesa) => sum + mesa.items.length, 0);
          const totalMesas = data.length;
          showToast(`${totalItems} ítems en ${totalMesas} mesa(s) cargados.`, 'success');
       }
    } catch (error) {
      if (error instanceof Error) {
        showToast(`Error de Sincronización: ${error.message}`, 'error');
      } else {
        showToast('Ocurrió un error de sincronización desconocido', 'error');
      }
    } finally {
      if (isInitialSync) {
        setTimeout(() => setIsSyncing(false), 500);
      }
    }
  }, [config]);
  
  useEffect(() => {
    if (screen === 'pos' && config) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      syncComandas(true); // Sincronización inicial con indicador
      syncIntervalRef.current = window.setInterval(() => syncComandas(false), 5000);
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [screen, config, syncComandas]);
  
  const handleClearVentas = () => {
      setVentasData([]);
      localStorage.removeItem('posVentas');
      setVentasHistory([]);
      localStorage.removeItem('posVentasHistory');
      showToast('¡Todos los datos de ventas (actuales e históricos) han sido eliminados!', 'success');
  };

  const handleConfirmCobro = async (mesa: MesaData, itemsToPay: any[], paymentMethod: string, divisionType: string, numPersonas: number) => {
    if (!config) return;
    const total = itemsToPay.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    
    const newVenta: Venta = {
        id: `venta_${Date.now()}`,
        mesa: mesa.mesa,
        items: itemsToPay,
        total: total,
        fecha: new Date().toISOString(),
        metodo_pago: paymentMethod,
        tipo_division: divisionType,
        personas: numPersonas
    };

    const updatedVentas = [...ventasData, newVenta];
    const updatedHistory = [...ventasHistory, newVenta];
    
    try {
        localStorage.setItem('posVentas', JSON.stringify(updatedVentas));
        localStorage.setItem('posVentasHistory', JSON.stringify(updatedHistory));
        setVentasData(updatedVentas);
        setVentasHistory(updatedHistory);
    } catch (error) {
        console.error("Error al guardar ventas en localStorage", error);
        showToast('Error al guardar la venta. El almacenamiento podría estar lleno.', 'error');
        return; // Detener la ejecución si no se pudo guardar
    }

    const itemIdsToUpdate = itemsToPay.map(item => item.id);
    await markItemsAsPaidInBaserow(itemIdsToUpdate, config);
    
    showToast(`Pago para ${mesa.mesa} registrado.`, 'success');

    if (paymentMethod === 'efectivo' && config.printerType === 'escpos') {
      openCashDrawer(config).catch(error => {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          showToast(`Error al abrir cajón: ${errorMessage}`, 'error');
      });
    }

    printComanda(config, mesa, itemsToPay, paymentMethod, divisionType, numPersonas)
      .then(() => {
        showToast('Ticket impreso exitosamente.', 'success');
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        showToast(`El pago se guardó, pero falló la impresión: ${errorMessage}`, 'error');
        console.error("La impresión falló:", error);
      });
    
    if (divisionType === 'platos') {
        const remainingItems = mesa.items.filter(item => !itemIdsToUpdate.includes(item.id));
        if (remainingItems.length > 0) {
            setComandasData(prevData => prevData.map(m => m.mesa === mesa.mesa ? { ...m, items: remainingItems } : m));
        } else {
            setComandasData(prevData => prevData.filter(m => m.mesa !== mesa.mesa));
        }
    } else {
        setComandasData(prevData => prevData.filter(m => m.mesa !== mesa.mesa));
    }
  };

  const handleCloseShift = async () => {
    if (ventasData.length === 0) {
        showToast('No hay ventas en el turno actual para reportar.', 'success');
        return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres cerrar el turno y empezar un nuevo día? Se imprimirá un reporte Z con ${ventasData.length} venta(s) y se reiniciará el conteo del turno actual.`)) {
        return;
    }

    try {
        if (!config) throw new Error("Configuración no encontrada");
        await printZReport(config, ventasData);
        showToast('Reporte Z impreso. Reiniciando ventas del turno.', 'success');
        setVentasData([]);
        localStorage.removeItem('posVentas');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        showToast(`Error al imprimir el reporte: ${errorMessage}`, 'error');
        console.error("Falló la impresión del reporte Z:", error);
    }
  };
  
  const renderContent = () => {
    switch (screen) {
      case 'config':
        return <ConfigScreen onSave={handleSaveConfig} showToast={showToast} existingConfig={config} onClearVentas={handleClearVentas} />;
      case 'pos':
        if (!config) return <ConfigScreen onSave={handleSaveConfig} showToast={showToast} onClearVentas={handleClearVentas} />;
        return <PosScreen 
                    config={config} 
                    comandasData={comandasData} 
                    ventasHistory={ventasHistory}
                    isSyncing={isSyncing}
                    onNavigateToConfig={() => setScreen('config')}
                    onConfirmCobro={handleConfirmCobro}
                    showToast={showToast}
                    onCloseShift={handleCloseShift}
                />;
      case 'loading':
      default:
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-2xl font-bold text-gray-700">Cargando...</div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-full p-4">
      {renderContent()}
      {toast && <Toast message={toast.message} type={toast.type} />}
       <footer className="mt-8 py-4 text-center">
        <div className="bg-white rounded-xl card-shadow p-3 mx-4 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
          <p className="text-sm text-gray-600">Powered By <span className="font-bold text-yellow-600">War</span></p>
        </div>
      </footer>
    </div>
  );
};

export default App;