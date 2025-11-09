import React from 'react';
import { MesaData } from '../types';
import { TableCellsIcon } from './icons/Icons';

interface MesaCardProps {
  mesaData: MesaData;
  onCobrarClick: (mesaData: MesaData) => void;
  isSelected: boolean;
  onSelect: (mesaData: MesaData) => void;
}

const MesaCard: React.FC<MesaCardProps> = ({ mesaData, onCobrarClick, isSelected, onSelect }) => {
  const { mesa, items } = mesaData;
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  return (
    <div 
      className={`bg-white rounded-2xl card-shadow p-6 hover:shadow-xl transition-all flex flex-col cursor-pointer ${isSelected ? 'ring-4 ring-yellow-400' : 'ring-2 ring-transparent'}`}
      onClick={() => onSelect(mesaData)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center">
            <TableCellsIcon className="w-6 h-6 text-white"/>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{mesa}</h3>
            <p className="text-sm text-gray-500">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
          Listo
        </div>
      </div>

      <div className="space-y-3 mb-4 flex-grow max-h-48 overflow-y-auto pr-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <div className="flex-1 truncate pr-2">
                <p className="text-gray-700 font-medium truncate">{item.cantidad}x {item.nombre}</p>
                {item.descripcion && <p className="text-xs text-gray-500 truncate">{item.descripcion}</p>}
            </div>
            <span className="font-semibold text-gray-800 whitespace-nowrap">${(item.precio * item.cantidad).toFixed(2)}</span>
          </div>
        ))}
      </div>


      <div className="border-t-2 border-gray-100 pt-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 font-semibold">Total:</span>
          <span className="text-2xl font-bold text-yellow-600">${total.toFixed(2)}</span>
        </div>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onCobrarClick(mesaData);
        }} 
        className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold py-3 rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all transform hover:scale-105"
      >
        Cobrar Comanda
      </button>
    </div>
  );
};

export default MesaCard;