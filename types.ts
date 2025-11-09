
export interface AppConfig {
  empresaNombre: string;
  empresaTelefono: string;
  empresaDireccion: string;
  printerType: 'escpos' | 'browser';
  paperWidth: '58' | '80';
  apiKey: string;
  tableNumber: string;
  fieldNombre: string;
  fieldDescripcion: string;
  fieldPrecio: string;
  fieldCantidad: string;
  fieldActivo: string;
  fieldTerminado: string;
  fieldCobrada: string;
  fieldMesa: string;
  fieldFechaIn: string;
}

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export interface ComandaItem {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
}

export interface MesaData {
  mesa: string;
  items: ComandaItem[];
}

export interface Venta {
    id: string;
    mesa: string;
    items: ComandaItem[];
    total: number;
    fecha: string;
    metodo_pago: string;
    tipo_division: string;
    personas: number;
}

export interface PrinterInfo {
  name: string;
  vendor: string;
  connected: boolean;
}