import React, { useState, useEffect } from 'react';
import { AppConfig, ToastState, PrinterInfo } from '../types';
import { BuildingStorefrontIcon, Cog6ToothIcon, CreditCardIcon, PrinterIcon, ServerStackIcon } from './icons/Icons';
import { detectUSBPrinter } from '../services/printerService';


interface ConfigScreenProps {
  onSave: (config: AppConfig) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  existingConfig?: AppConfig | null;
  onClearVentas: () => void;
}

const ConfigScreen: React.FC<ConfigScreenProps> = ({ onSave, showToast, existingConfig, onClearVentas }) => {
  const [formData, setFormData] = useState<AppConfig>({
    empresaNombre: '',
    empresaTelefono: '',
    empresaDireccion: '',
    printerType: 'browser',
    paperWidth: '80',
    apiKey: '',
    tableNumber: '',
    fieldNombre: '',
    fieldDescripcion: '',
    fieldPrecio: '',
    fieldCantidad: '',
    fieldActivo: '',
    fieldTerminado: '',
    fieldCobrada: '',
    fieldMesa: '',
    fieldFechaIn: '',
  });
  const [printerStatus, setPrinterStatus] = useState<string>('Ninguna impresora conectada');
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  useEffect(() => {
    if (existingConfig) {
      setFormData(existingConfig);
    }
  }, [existingConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const handleDetectPrinter = async () => {
      setIsDetecting(true);
      setPrinterStatus('Buscando impresoras USB...');
      try {
        const info = await detectUSBPrinter();
        setPrinterStatus(`✅ Conectada: ${info.name} (${info.vendor})`);
        showToast('🖨️ ¡Impresora conectada exitosamente!', 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        setPrinterStatus(`❌ Error: ${errorMessage}`);
        showToast(errorMessage, 'error');
      } finally {
        setIsDetecting(false);
      }
  };
  
  const handleClearData = () => {
    if(window.confirm('¿Estás seguro de que quieres borrar permanentemente TODOS los datos de ventas, incluido el historial? Esta acción no se puede deshacer.')) {
        onClearVentas();
    }
  };


  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl card-shadow p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full mb-4">
            <Cog6ToothIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Configuración Inicial</h1>
          <p className="text-gray-500">Configure la conexión de su base de datos y los datos de la empresa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Company Data */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center text-lg">
              <BuildingStorefrontIcon className="w-6 h-6 text-blue-500 mr-3" /> Detalles de la Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Empresa *</label>
                <input type="text" id="empresaNombre" value={formData.empresaNombre} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors" placeholder="Mi Restaurante Increíble" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                <input type="text" id="empresaTelefono" value={formData.empresaTelefono} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors" placeholder="(555) 123-4567" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dirección</label>
                <input type="text" id="empresaDireccion" value={formData.empresaDireccion} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors" placeholder="Calle Principal 123, Ciudad" />
              </div>
            </div>
          </div>

          {/* Printer Config */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center text-lg">
                <PrinterIcon className="w-6 h-6 text-green-500 mr-3" /> Configuración de Impresora
            </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Impresora</label>
                    <select id="printerType" value={formData.printerType} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none transition-colors">
                        <option value="escpos">Impresora Térmica ESC/POS</option>
                        <option value="browser">Impresora del Sistema (Navegador)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ancho del Papel</label>
                    <select id="paperWidth" value={formData.paperWidth} onChange={handleChange} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none transition-colors">
                        <option value="58">58mm (Pequeño)</option>
                        <option value="80">80mm (Estándar)</option>
                    </select>
                </div>
            </div>
             <div className="bg-white rounded-lg p-4 mb-4">
                 <div className="flex items-center justify-between mb-3">
                     <h4 className="font-semibold text-gray-800">Estado de la Impresora</h4>
                     <button type="button" onClick={handleDetectPrinter} disabled={isDetecting} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-semibold disabled:bg-green-300">
                        {isDetecting ? 'Detectando...' : 'Detectar Impresora USB'}
                    </button>
                 </div>
                 <div className="text-sm text-gray-600">{printerStatus}</div>
             </div>
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                 <h4 className="font-semibold text-blue-800 mb-2">💡 Instrucciones:</h4>
                 <ul className="text-sm text-blue-700 space-y-1">
                     <li>• <strong>ESC/POS:</strong> Para impresoras térmicas (Epson, Star, etc.)</li>
                     <li>• <strong>Sistema:</strong> Para impresoras normales (Inyección, Láser).</li>
                     <li>• Conecta tu impresora USB antes de detectar.</li>
                     <li>• Chrome/Edge requerido para impresoras USB.</li>
                 </ul>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                     <p className="text-xs text-blue-600">
                         <strong>¿Error de "Acceso denigado"?</strong> A veces, el controlador del sistema operativo bloquea la conexión USB. Si esto ocurre, la opción más sencilla es usar la "Impresora del Sistema (Navegador)".
                     </p>
                 </div>
             </div>
          </div>


          {/* Database Config */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center text-lg">
                <ServerStackIcon className="w-6 h-6 text-amber-500 mr-3" /> Configuración de Base de Datos (Baserow)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">API Key de Baserow *</label>
                <input type="password" id="apiKey" value={formData.apiKey} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none transition-colors" placeholder="Ingrese su API Key" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID de Tabla *</label>
                <input type="text" id="tableNumber" value={formData.tableNumber} onChange={handleChange} required className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none transition-colors" placeholder="ej., 12345" />
              </div>
            </div>
          </div>
          
           {/* Database Fields */}
           <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
             <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
               <CreditCardIcon className="w-5 h-5 text-amber-500 mr-2" /> IDs de Campos de la Base de Datos
             </h3>
             <p className="text-sm text-gray-600 mb-4">Ingrese el número de ID para cada campo (ej., `1234` para `field_1234`)</p>
             <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 rounded-md mb-4 text-sm">
                <p><strong>Importante:</strong> El campo 'Fecha de Entrada' <strong>debe ser de tipo "Texto de una sola línea"</strong> en Baserow y el formato de la fecha debe ser <strong>D/M/AAAA</strong> (ejemplo: 25/12/2024).</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {[
                    {id: 'fieldNombre', label: 'Nombre'},
                    {id: 'fieldDescripcion', label: 'Descripción'},
                    {id: 'fieldPrecio', label: 'Precio'},
                    {id: 'fieldCantidad', label: 'Cantidad'},
                    {id: 'fieldActivo', label: 'Activo (booleano)'},
                    {id: 'fieldTerminado', label: 'Terminado (booleano)'},
                    {id: 'fieldCobrada', label: 'Cobrado (booleano)'},
                    {id: 'fieldMesa', label: 'Mesa'},
                    {id: 'fieldFechaIn', label: 'Fecha de Entrada (Texto)'},
                ].map(field => (
                     <div key={field.id}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-2">field_</span>
                            <input type="number" id={field.id} value={formData[field.id as keyof AppConfig]} onChange={handleChange} required className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none" />
                        </div>
                    </div>
                ))}
            </div>
           </div>

          <button type="submit" className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold py-4 rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all transform hover:scale-105 shadow-lg">
            Guardar Configuración
          </button>
        </form>

        {/* Danger Zone */}
        <div className="mt-8 border-t-2 border-dashed border-red-300 pt-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center text-lg text-red-600">
                Zona de Peligro
            </h3>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div className="mb-4 sm:mb-0">
                    <h4 className="font-semibold text-red-800">Limpiar Datos de Ventas</h4>
                    <p className="text-sm text-red-700 mt-1">
                        Esto eliminará permanentemente todo el historial de ventas (turnos actuales y pasados) guardado en este dispositivo.
                    </p>
                </div>
                <button 
                    type="button" 
                    onClick={handleClearData} 
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold self-start sm:self-center"
                >
                    Limpiar Datos
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigScreen;