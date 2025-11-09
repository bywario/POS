import React, { useState, useMemo, useEffect } from 'react';
import { Venta, AppConfig } from '../types';
import { BarChartIcon, CloseIcon, TrophyIcon, ClipboardDocumentListIcon, ChartPieIcon, PrinterIcon, DocumentArrowDownIcon } from './icons/Icons';
import { fetchSalesDataFromBaserow } from '../services/baserowService';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ventasHistory: Venta[];
  config: AppConfig;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, ventasHistory, config, showToast }) => {
  const [fetchedVentas, setFetchedVentas] = useState<Venta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  useEffect(() => {
    if (isOpen) {
      const loadSalesData = async () => {
        setIsLoading(true);
        setFetchedVentas([]); // Clear previous data
        try {
          const data = await fetchSalesDataFromBaserow(config, selectedDate.year, selectedDate.month);
          setFetchedVentas(data);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error desconocido';
          showToast(`No se pudieron cargar las estadísticas: ${msg}`, 'error');
        } finally {
          setIsLoading(false);
        }
      };
      loadSalesData();
    }
  }, [isOpen, selectedDate, config, showToast]);

  const years = useMemo(() => {
    if (ventasHistory.length === 0) return [new Date().getFullYear()];
    const allYears = new Set(ventasHistory.map(v => new Date(v.fecha).getFullYear()));
    return Array.from(allYears).sort((a: number, b: number) => b - a);
  }, [ventasHistory]);

  const stats = useMemo(() => {
    const totalVentas = fetchedVentas.reduce((sum, venta) => sum + venta.total, 0);
    const totalTransacciones = fetchedVentas.length;
    const promedioVenta = totalTransacciones > 0 ? totalVentas / totalTransacciones : 0;

    const productosVendidos: { [key: string]: { nombre: string; cantidad: number; total: number } } = {};
    fetchedVentas.forEach(venta => {
      venta.items.forEach(item => {
        if (!productosVendidos[item.nombre]) {
          productosVendidos[item.nombre] = { nombre: item.nombre, cantidad: 0, total: 0 };
        }
        productosVendidos[item.nombre].cantidad += item.cantidad;
        productosVendidos[item.nombre].total += item.precio * item.cantidad;
      });
    });

    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return { totalVentas, totalTransacciones, promedioVenta, topProductos };
  }, [fetchedVentas]);

  const handleExportCSV = () => {
    if (fetchedVentas.length === 0) {
      showToast('No hay datos para exportar en el período seleccionado.', 'error');
      return;
    }
    const headers = ['ID', 'Fecha', 'Mesa', 'Items', 'Cantidad Total Items', 'Total Venta'];
    const rows = fetchedVentas.map(venta => {
      const date = new Date(venta.fecha);
      const itemsStr = venta.items.map(i => `${i.cantidad}x ${i.nombre.replace(/,/g, '')}`).join('; ');
      const rowData = [
        venta.id,
        date.toLocaleString('es-ES'),
        venta.mesa,
        `"${itemsStr}"`,
        venta.items.reduce((sum, i) => sum + i.cantidad, 0),
        venta.total.toFixed(2)
      ];
      return rowData.join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ventas_${selectedDate.year}_${MONTH_NAMES[selectedDate.month]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte CSV exportado.', 'success');
  };

  const handlePrintReport = () => {
    if (fetchedVentas.length === 0) {
      showToast('No hay datos para imprimir en el período seleccionado.', 'error');
      return;
    }
    const reportHTML = `
      <html><head><title>Reporte de Ventas</title><style>
        body { font-family: sans-serif; margin: 20px; } h1, h2 { text-align: center; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } .summary { display: flex; justify-content: space-around; margin: 20px 0; padding: 10px; background: #f9f9f9; border-radius: 8px; } .summary-item { text-align: center; }
      </style></head><body>
        <h1>Reporte de Ventas</h1> <h2>${MONTH_NAMES[selectedDate.month]} ${selectedDate.year}</h2>
        <div class="summary">
          <div class="summary-item"><h3>Ventas Totales</h3><p>$${stats.totalVentas.toFixed(2)}</p></div>
          <div class="summary-item"><h3>Transacciones</h3><p>${stats.totalTransacciones}</p></div>
          <div class="summary-item"><h3>Venta Promedio</h3><p>$${stats.promedioVenta.toFixed(2)}</p></div>
        </div>
        <h3>Detalle de Transacciones</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Mesa</th><th>Items</th><th>Total</th></tr></thead>
          <tbody>
            ${fetchedVentas.map(v => `
              <tr>
                <td>${new Date(v.fecha).toLocaleString('es-ES')}</td>
                <td>${v.mesa}</td>
                <td>${v.items.map(i => `${i.cantidad}x ${i.nombre}`).join('<br>')}</td>
                <td>$${v.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col slide-in">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Estadísticas de Ventas</h2>
              <p className="text-blue-100 mt-1">Datos obtenidos directamente desde Baserow</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-100 transition-colors">
              <CloseIcon className="w-8 h-8" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-2">
              <select value={selectedDate.month} onChange={e => setSelectedDate(d => ({ ...d, month: parseInt(e.target.value) }))} className="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 font-semibold">
                {MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
              </select>
              <select value={selectedDate.year} onChange={e => setSelectedDate(d => ({ ...d, year: parseInt(e.target.value) }))} className="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 font-semibold">
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handlePrintReport} className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold">
                    <PrinterIcon className="w-5 h-5 mr-2" /> Imprimir Reporte
                </button>
                <button onClick={handleExportCSV} className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-semibold">
                    <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Exportar CSV
                </button>
            </div>
          </div>
          
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="text-gray-500 mt-4">Cargando datos desde Baserow...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <StatCard icon={<BarChartIcon className="w-12 h-12 text-green-200" />} title="Ventas Totales" value={`$${stats.totalVentas.toFixed(2)}`} color="green" />
                <StatCard icon={<ClipboardDocumentListIcon className="w-12 h-12 text-blue-200" />} title="Transacciones" value={`${stats.totalTransacciones}`} color="blue" />
                <StatCard icon={<ChartPieIcon className="w-12 h-12 text-purple-200" />} title="Venta Promedio" value={`$${stats.promedioVenta.toFixed(2)}`} color="purple" />
              </div>

              <div className="bg-white rounded-xl p-6 border">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Productos Más Vendidos</h3>
                {stats.topProductos.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topProductos.map((prod, index) => (
                      <div key={prod.nombre} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-yellow-600' : 'bg-gray-300'}`}>
                            {index < 3 ? <TrophyIcon className="w-5 h-5" /> : index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">{prod.nombre}</h4>
                            <p className="text-sm text-gray-500">Vendido {prod.cantidad} veces</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">${prod.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay datos de ventas para este período.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: string, color: string }> = ({ icon, title, value, color }) => {
  const gradients: { [key: string]: string } = {
    green: 'from-green-400 to-green-500',
    blue: 'from-blue-400 to-blue-500',
    purple: 'from-purple-400 to-purple-500',
  };
  const textColors: { [key: string]: string } = {
    green: 'text-green-100',
    blue: 'text-blue-100',
    purple: 'text-purple-100',
  };
  return (
    <div className={`bg-gradient-to-br ${gradients[color]} rounded-xl p-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`${textColors[color]} text-sm`}>{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
};

export default StatsModal;
