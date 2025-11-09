import React, { useState, useEffect, useMemo } from 'react';
import { MesaData, ComandaItem, AppConfig } from '../types';
import { CloseIcon, CreditCardIcon, CurrencyDollarIcon, PrinterIcon } from './icons/Icons';
import { printComanda } from '../services/printerService';

interface CobroModalProps {
  isOpen: boolean;
  onClose: () => void;
  mesaData: MesaData;
  onConfirm: (mesa: MesaData, itemsToPay: ComandaItem[], paymentMethod: string, divisionType: string, numPersonas: number) => void;
  config: AppConfig;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const CobroModal: React.FC<CobroModalProps> = ({ isOpen, onClose, mesaData, onConfirm, config, showToast }) => {
  const [divisionType, setDivisionType] = useState<'completa' | 'personas' | 'platos'>('completa');
  const [numPersonas, setNumPersonas] = useState<number>(2);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set(mesaData.items.map(item => item.id)));
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | null>(null);

  useEffect(() => {
    // Resetear estado cuando el modal se abre para una nueva mesa
    setDivisionType('completa');
    setNumPersonas(2);
    setSelectedItems(new Set(mesaData.items.map(item => item.id)));
    setPaymentMethod(null);
  }, [mesaData]);
  
  const handleItemToggle = (itemId: number) => {
    setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
            newSet.delete(itemId);
        } else {
            newSet.add(itemId);
        }
        return newSet;
    });
  };

  const { total, itemsToPay } = useMemo(() => {
    let currentItems: ComandaItem[];
    if (divisionType === 'platos') {
        currentItems = mesaData.items.filter(item => selectedItems.has(item.id));
    } else {
        currentItems = mesaData.items;
    }
    const currentTotal = currentItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    return { total: currentTotal, itemsToPay: currentItems };
  }, [divisionType, selectedItems, mesaData.items]);
  
  const handleConfirm = () => {
      if (paymentMethod && itemsToPay.length > 0) {
          onConfirm(mesaData, itemsToPay, paymentMethod, divisionType, numPersonas);
          onClose();
      }
  };

  const handlePrint = () => {
    showToast('Enviando ticket a la impresora...', 'success');
    printComanda(config, mesaData, itemsToPay, paymentMethod, divisionType, numPersonas)
        .then(() => {
            showToast('¡Ticket enviado a la impresora!', 'success');
        })
        .catch((error) => {
            showToast(error instanceof Error ? error.message : 'Error al imprimir', 'error');
        });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90%] overflow-y-auto slide-in">
        <div className="sticky top-0 bg-gradient-to-r from-yellow-400 to-amber-500 p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Cobrar Comanda</h2>
              <p className="text-yellow-100 mt-1">{mesaData.mesa}</p>
            </div>
            <div className="flex items-center space-x-2">
                <button onClick={handlePrint} className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors">
                    <PrinterIcon className="w-6 h-6 text-white" />
                </button>
                <button onClick={onClose} className="text-white hover:text-yellow-100 transition-colors">
                    <CloseIcon className="w-8 h-8"/>
                </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Opciones de división */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Dividir Cuenta</h3>
            <div className="space-y-3">
              {(['completa', 'personas', 'platos'] as const).map(type => (
                <label key={type} className="flex items-center space-x-3 cursor-pointer">
                  <input type="radio" name="divisionType" value={type} checked={divisionType === type} onChange={() => setDivisionType(type)} className="w-4 h-4 text-yellow-500 focus:ring-yellow-400"/>
                  <span className="text-gray-700 capitalize">{type === 'completa' ? 'Cuenta completa' : type === 'personas' ? 'Dividir por persona' : 'Seleccionar ítems específicos'}</span>
                </label>
              ))}
            </div>
            {divisionType === 'personas' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Número de personas:</label>
                <input type="number" value={numPersonas} onChange={(e) => setNumPersonas(Math.max(2, parseInt(e.target.value) || 2))} min="2" max="20" className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none" />
              </div>
            )}
          </div>

          {/* Items de la Comanda */}
          <div className="space-y-3 mb-6">
            {mesaData.items.map(item => (
                 <div key={item.id} className="item-row bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        {divisionType === 'platos' && (
                            <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleItemToggle(item.id)} className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-400 shrink-0"/>
                        )}
                        <div>
                            <h4 className="font-semibold text-gray-800">{item.nombre}</h4>
                            {item.descripcion && <p className="text-sm text-gray-500 mt-1">{item.descripcion}</p>}
                            <p className="text-sm text-gray-600 mt-2">Cant: {item.cantidad} x ${item.precio.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-gray-800">${(item.precio * item.cantidad).toFixed(2)}</p>
                    </div>
                </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-200 pt-4 mb-6">
            <div className="flex items-center justify-between text-2xl font-bold">
              <span className="text-gray-800">Total a cobrar:</span>
              <span className="text-yellow-600">${total.toFixed(2)}</span>
            </div>
            {divisionType === 'personas' && (
              <div className="text-right text-lg text-gray-600 mt-2">
                Por persona: <span className="font-semibold">${(total / numPersonas).toFixed(2)}</span>
              </div>
            )}
          </div>
          
          {/* Método de Pago */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Método de Pago</h3>
            <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setPaymentMethod('efectivo')} className={`flex items-center justify-center space-x-2 p-4 border-2 rounded-xl transition-colors ${paymentMethod === 'efectivo' ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}>
                    <CurrencyDollarIcon className="w-6 h-6 text-green-500" /> <span className="font-semibold">Efectivo</span>
                 </button>
                 <button onClick={() => setPaymentMethod('tarjeta')} className={`flex items-center justify-center space-x-2 p-4 border-2 rounded-xl transition-colors ${paymentMethod === 'tarjeta' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
                    <CreditCardIcon className="w-6 h-6 text-blue-500" /> <span className="font-semibold">Tarjeta</span>
                </button>
            </div>
          </div>
          
          {/* Botones de Acción */}
          <div className="flex space-x-4">
            <button onClick={onClose} className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button>
            <button onClick={handleConfirm} disabled={!paymentMethod || itemsToPay.length === 0} className="flex-1 px-6 py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Cobro</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CobroModal;