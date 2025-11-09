import { AppConfig, MesaData, ComandaItem, Venta } from '../types';

// Esta función maneja los tipos de campo comunes de Baserow de forma más robusta.
const getFieldValue = (row: any, fieldId: string): any => {
    const rawValue = row[`field_${fieldId}`];

    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    // Maneja Link to Table, Multiple Select, o Lookup que devuelven un array.
    if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) {
            return null; // Devuelve null si el array está vacío para usar el fallback.
        }

        const firstItem = rawValue[0];

        if (typeof firstItem === 'object' && firstItem !== null && 'value' in firstItem) {
            // Es un array de objetos, como en Link to Table o Multiple Select.
            return rawValue
                .filter(item => typeof item === 'object' && item !== null && item.value)
                .map(item => item.value)
                .join(', ');
        } else if (typeof firstItem === 'string' || typeof firstItem === 'number' || typeof firstItem === 'boolean') {
            // Es un array de valores primitivos, común en campos Lookup.
            return rawValue.join(', ');
        }
        
        // Si el array contiene algo inesperado, devuelve null.
        return null;
    }
    
    // Maneja Single Select (objeto con 'value')
    if (typeof rawValue === 'object' && rawValue !== null && 'value' in rawValue) {
        return rawValue.value;
    }

    // Maneja otros tipos primitivos (Texto, Número, etc.)
    return rawValue;
};


export const fetchComandasFromBaserow = async (config: AppConfig): Promise<MesaData[]> => {
  const { apiKey, tableNumber, fieldActivo, fieldCobrada, fieldMesa, fieldNombre, fieldDescripcion, fieldPrecio, fieldCantidad } = config;
  const url = `https://api.baserow.io/api/database/rows/table/${tableNumber}/?filter__field_${fieldActivo}__boolean=false&filter__field_${fieldCobrada}__boolean=false`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Error API Baserow (${response.status}): ${errorData.detail || response.statusText}`);
  }

  const data = await response.json();

  if (!data.results) {
    return [];
  }

  const comandasListas = data.results;

  const mesasAgrupadas: { [key: string]: ComandaItem[] } = {};
  
  comandasListas.forEach((comanda: any) => {
    // Usando la función robusta getFieldValue para todos los campos.
    const mesaName = getFieldValue(comanda, fieldMesa) || 'Mesa General';
    const item: ComandaItem = {
      id: comanda.id,
      nombre: getFieldValue(comanda, fieldNombre) || 'Producto Sin Nombre',
      descripcion: getFieldValue(comanda, fieldDescripcion) || '',
      precio: parseFloat(getFieldValue(comanda, fieldPrecio)) || 0,
      cantidad: parseInt(getFieldValue(comanda, fieldCantidad)) || 1
    };

    if (!mesasAgrupadas[mesaName]) {
      mesasAgrupadas[mesaName] = [];
    }
    mesasAgrupadas[mesaName].push(item);
  });

  return Object.keys(mesasAgrupadas).map(mesaName => ({
    mesa: mesaName,
    items: mesasAgrupadas[mesaName]
  }));
};


export const markItemsAsPaidInBaserow = async (itemIds: number[], config: AppConfig): Promise<void> => {
    const { apiKey, tableNumber, fieldCobrada } = config;
    
    const updatePromises = itemIds.map(id => {
        const url = `https://api.baserow.io/api/database/rows/table/${tableNumber}/${id}/`;
        return fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                [`field_${fieldCobrada}`]: true
            })
        });
    });

    const results = await Promise.allSettled(updatePromises);
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Falló al actualizar el ítem ${itemIds[index]}:`, result.reason);
        } else if (!result.value.ok) {
            console.error(`Falló al actualizar el ítem ${itemIds[index]}, estado: ${result.value.status}`);
        }
    });
};

export const fetchSalesDataFromBaserow = async (config: AppConfig, year: number, month: number): Promise<Venta[]> => {
    if (!config.fieldFechaIn) {
        throw new Error("El ID del campo 'Fecha de Entrada' no está configurado.");
    }

    const { apiKey, tableNumber, fieldCobrada, fieldFechaIn } = config;

    let allPaidItems: any[] = [];
    let url: string | null = `https://api.baserow.io/api/database/rows/table/${tableNumber}/?size=200&filter__field_${fieldCobrada}__boolean=true`;

    while (url) {
        const response = await fetch(url, { headers: { 'Authorization': `Token ${apiKey}` } });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error API Baserow (${response.status}): ${errorData.detail || response.statusText}`);
        }
        const data = await response.json();
        allPaidItems = allPaidItems.concat(data.results);
        url = data.next;
    }

    const filteredItems = allPaidItems.filter(row => {
        const dateStr = getFieldValue(row, fieldFechaIn);
        if (typeof dateStr !== 'string' || !dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            return false;
        }

        const parts = dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const monthPart = parseInt(parts[1], 10);
        const yearPart = parseInt(parts[2], 10);
        
        const itemDate = new Date(yearPart, monthPart - 1, day);
        
        return itemDate.getFullYear() === year && itemDate.getMonth() === month;
    });

    const transactions: { [key: string]: { items: ComandaItem[], fecha: string, mesa: string } } = {};

    filteredItems.forEach(row => {
        const item: ComandaItem = {
            id: row.id,
            nombre: getFieldValue(row, config.fieldNombre) || 'Producto Sin Nombre',
            descripcion: getFieldValue(row, config.fieldDescripcion) || '',
            precio: parseFloat(getFieldValue(row, config.fieldPrecio)) || 0,
            cantidad: parseInt(getFieldValue(row, config.fieldCantidad)) || 1
        };
        const mesaName = getFieldValue(row, config.fieldMesa) || 'General';
        const fechaInStr = getFieldValue(row, fieldFechaIn);
        
        const parts = fechaInStr.split('/');
        const day = parseInt(parts[0], 10);
        const monthPart = parseInt(parts[1], 10);
        const yearPart = parseInt(parts[2], 10);
        const itemDate = new Date(yearPart, monthPart - 1, day);

        const transactionDate = itemDate.toISOString().split('T')[0];
        const transactionKey = `${mesaName}__${transactionDate}`;

        if (!transactions[transactionKey]) {
            transactions[transactionKey] = { items: [], fecha: itemDate.toISOString(), mesa: mesaName };
        }
        transactions[transactionKey].items.push(item);
    });

    return Object.entries(transactions).map(([key, trans]) => {
        const total = trans.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
        return {
            id: `baserow_${key}`,
            mesa: trans.mesa,
            items: trans.items,
            total: total,
            fecha: trans.fecha,
            metodo_pago: 'desconocido',
            tipo_division: 'completa',
            personas: 1
        };
    });
};