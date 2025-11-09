import { AppConfig, ComandaItem, MesaData, PrinterInfo, Venta } from "../types";

class ESCPOSPrinter {
    // FIX: Changed USBDevice to any to resolve missing type definition.
    private device: any | null = null;
    public isConnected: boolean = false;

    async detectUSBPrinter(): Promise<PrinterInfo> {
        // FIX: Cast navigator to any to access the 'usb' property, which is not in the default TS DOM types.
        if (!(navigator as any).usb) {
            throw new Error('WebUSB no es compatible con este navegador.');
        }

        try {
            // Se añaden más Vendor IDs para mayor compatibilidad, incluyendo HPRT.
            const filters = [
                { vendorId: 0x04b8 }, // Epson
                { vendorId: 0x0519 }, // Star Micronics
                { vendorId: 0x1FC9 }, // HPRT
                { vendorId: 0x154f }, // Citizen
                { vendorId: 0x20d1 }, // Rongta
                { vendorId: 0x0fe6 }, // ICS Advent
            ];

            // FIX: Cast navigator to any to access the 'usb' property.
            this.device = await (navigator as any).usb.requestDevice({ filters });
            
            if (this.device) {
                await this.device.open();
                await this.device.selectConfiguration(1);
                await this.device.claimInterface(0);
                this.isConnected = true;
                return {
                    name: this.device.productName || 'Impresora Térmica',
                    vendor: this.device.manufacturerName || 'Desconocido',
                    connected: true
                };
            }
            throw new Error("No se seleccionó ningún dispositivo compatible.");
        } catch (error) {
            console.error('Error al detectar la impresora USB:', error);
            this.isConnected = false;
            if (error instanceof Error && (error.message.includes('Access denied') || error.message.includes('Unable to claim interface'))) {
                throw new Error(
                    'Acceso denegado. Un controlador del sistema operativo puede estar bloqueando la conexión. Pruebe la "Impresora del Sistema".'
                );
            }
            throw error;
        }
    }
    
    private async sendCommand(command: Uint8Array): Promise<void> {
        if (!this.isConnected || !this.device) {
            throw new Error('Impresora no conectada.');
        }
        try {
            const endpointNumber = this.device.configuration?.interfaces[0].alternate.endpoints.find((e: any) => e.direction === 'out')?.endpointNumber;
            if(!endpointNumber) throw new Error("No se pudo encontrar el punto final de la impresora.");
            await this.device.transferOut(endpointNumber, command);
        } catch (error) {
            console.error('Error al enviar comando:', error);
            throw new Error(`Falló el envío de comando: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    async openDrawer(): Promise<void> {
        const command = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]); // ESC p 0 25 250
        await this.sendCommand(command);
    }

    private stringToBytes(str: string): number[] {
        const encoder = new TextEncoder();
        return Array.from(encoder.encode(str));
    }
    
    private generateTicketCommands(ticketData: any, config: AppConfig, generator: (data: any, config: AppConfig) => Uint8Array): Uint8Array {
      return generator(ticketData, config);
    }

    private generateComandaCommands(ticketData: any, config: AppConfig): Uint8Array {
        const commands: number[] = [];
        const push = (...args: number[]) => commands.push(...args);
    
        const lineWidth = config.paperWidth === '80' ? 48 : 32;
        const hr = '='.repeat(lineWidth) + '\n';
        const hr2 = '-'.repeat(lineWidth) + '\n';
    
        // Init
        push(0x1B, 0x40);
    
        // Header
        push(0x1B, 0x61, 0x01); // Center
        push(0x1D, 0x21, 0x11); // Double size
        push(...this.stringToBytes(ticketData.empresa + '\n'));
        push(0x1D, 0x21, 0x00); // Normal size
        if (ticketData.direccion) push(...this.stringToBytes(ticketData.direccion + '\n'));
        if (ticketData.telefono) push(...this.stringToBytes(`Tel: ${ticketData.telefono}\n`));
        push(...this.stringToBytes(hr));
        
        // Info
        push(0x1B, 0x61, 0x00); // Left align
        push(...this.stringToBytes(`Mesa: ${ticketData.mesa}\n`));
        push(...this.stringToBytes(`Fecha: ${ticketData.fecha}\n`));
        push(...this.stringToBytes(`Hora: ${ticketData.hora}\n\n`));
        
        // Items
        ticketData.items.forEach((item: ComandaItem) => {
            const itemTotal = (item.precio * item.cantidad).toFixed(2);
            const priceStr = `$${itemTotal}`;
            let nameStr = `${item.cantidad}x ${item.nombre}`;
            
            const availableWidth = lineWidth - priceStr.length - 1;
            if (nameStr.length > availableWidth) {
                nameStr = nameStr.substring(0, availableWidth - 3) + '...';
            }
    
            const line = nameStr.padEnd(lineWidth - priceStr.length) + priceStr;
            push(...this.stringToBytes(line + '\n'));
        });
        
        push(...this.stringToBytes(hr2));
    
        // Total
        push(0x1B, 0x61, 0x02); // Right align
        push(0x1D, 0x21, 0x11); // Double size
        push(...this.stringToBytes(`TOTAL: $${ticketData.total.toFixed(2)}\n\n`));
    
        // Footer
        push(0x1B, 0x61, 0x01); // Center
        push(0x1D, 0x21, 0x00); // Normal size
        push(...this.stringToBytes('¡Gracias por su compra!\n'));
    
        // Cut
        push(0x0A, 0x0A, 0x0A, 0x0A, 0x0A);
        push(0x1D, 0x56, 0x42, 0x00);
    
        return new Uint8Array(commands);
    }
    
    async print(ticketData: any, config: AppConfig): Promise<void> {
        const commands = this.generateComandaCommands(ticketData, config);
        await this.sendCommand(commands);
    }
}

const printer = new ESCPOSPrinter();

export const detectUSBPrinter = () => printer.detectUSBPrinter();

export const openCashDrawer = async (config: AppConfig) => {
  if (config.printerType !== 'escpos') {
    throw new Error('La apertura del cajón solo es compatible con impresoras ESC/POS.');
  }
  await printer.openDrawer();
};

const printComandaBrowser = (config: AppConfig, mesaData: MesaData, itemsToPrint: ComandaItem[], paymentMethod: string | null, divisionType: string, numPersonas: number) => {
    const total = itemsToPrint.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    const now = new Date();
    const ticketHTML = `
        <html><head><title></title><style>
            @media print {
                @page { margin: 0; }
                body { margin: 0; }
            }
            body { font-family: monospace; font-size: 12px; max-width: 300px; margin: auto; padding: 10px; }
            h1, p { margin: 0; }
            h1 { text-align: center; font-size: 16px; }
            hr { border: none; border-top: 1px dashed black; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0;}
            .right { text-align: right; }
            .center { text-align: center; }
        </style></head><body>
            <h1>${config.empresaNombre}</h1>
            ${config.empresaDireccion ? `<p class="center">${config.empresaDireccion}</p>` : ''}
            ${config.empresaTelefono ? `<p class="center">Tel: ${config.empresaTelefono}</p>` : ''}
            <hr />
            <p class="center">Mesa: ${mesaData.mesa}</p>
            <p class="center">${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
            <hr />
            <table>
                ${itemsToPrint.map(item => `
                    <tr>
                        <td>${item.cantidad}x ${item.nombre}</td>
                        <td class="right">$${(item.precio * item.cantidad).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </table>
            <hr />
            <p class="right" style="font-size: 16px; font-weight: bold;">TOTAL: $${total.toFixed(2)}</p>
            ${divisionType === 'personas' && numPersonas > 1 ? `<p class="right">Por persona: $${(total / numPersonas).toFixed(2)}</p>` : ''}
            ${paymentMethod ? `<p class="center" style="margin-top: 5px;">Método de pago: ${paymentMethod}</p>` : ''}
            <hr />
            <p class="center">¡Gracias por su compra!</p>
        </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(ticketHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
};

export const printComanda = async (config: AppConfig, mesaData: MesaData, itemsToPrint: ComandaItem[], paymentMethod: string | null, divisionType: string, numPersonas: number) => {
    const total = itemsToPrint.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    const now = new Date();
    
    const ticketData = {
        empresa: config.empresaNombre,
        direccion: config.empresaDireccion,
        telefono: config.empresaTelefono,
        mesa: mesaData.mesa,
        fecha: now.toLocaleDateString('es-ES'),
        hora: now.toLocaleTimeString('es-ES'),
        items: itemsToPrint,
        total: total,
    };

    if (config.printerType === 'escpos' && printer.isConnected) {
        await printer.print(ticketData, config);
    } else {
        printComandaBrowser(config, mesaData, itemsToPrint, paymentMethod, divisionType, numPersonas);
    }
};

const printZReportBrowser = (config: AppConfig, ventasData: Venta[]) => {
    const totalVentas = ventasData.reduce((sum, venta) => sum + venta.total, 0);
    const totalEfectivo = ventasData.filter(v => v.metodo_pago === 'efectivo').reduce((sum, v) => sum + v.total, 0);
    const totalTarjeta = ventasData.filter(v => v.metodo_pago === 'tarjeta').reduce((sum, v) => sum + v.total, 0);
    const totalTransacciones = ventasData.length;
    const now = new Date();

    const reportHTML = `
        <html><head><title>Reporte Z</title><style>
            @media print { @page { margin: 0; } body { margin: 0; } }
            body { font-family: monospace; font-size: 12px; max-width: 300px; margin: auto; padding: 10px; }
            h1, p { margin: 0; }
            h1 { text-align: center; font-size: 16px; }
            h2 { text-align: center; font-size: 14px; margin: 10px 0; border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 5px 0;}
            hr { border: none; border-top: 1px dashed black; margin: 5px 0; }
            table { width: 100%; }
            td { padding: 2px 0;}
            .right { text-align: right; }
            .center { text-align: center; }
        </style></head><body>
            <h1>${config.empresaNombre}</h1>
            <p class="center">${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
            <h2>CORTE DE CAJA (Z)</h2>
            <table>
                <tr><td>Total de Transacciones:</td><td class="right">${totalTransacciones}</td></tr>
                <tr style="font-weight: bold;"><td>Total en Efectivo:</td><td class="right">$${totalEfectivo.toFixed(2)}</td></tr>
                <tr style="font-weight: bold;"><td>Total en Tarjeta:</td><td class="right">$${totalTarjeta.toFixed(2)}</td></tr>
            </table>
            <hr />
            <p class="right" style="font-size: 16px; font-weight: bold;">VENTA TOTAL: $${totalVentas.toFixed(2)}</p>
            <br>
            <p class="center">Fin del Reporte</p>
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

const generateZReportCommands = (reportData: any, config: AppConfig): Uint8Array => {
    const commands: number[] = [];
    const push = (...args: number[]) => commands.push(...args);
    const s2b = (str: string) => Array.from(new TextEncoder().encode(str));
    const lineWidth = config.paperWidth === '80' ? 48 : 32;
    const hr = '='.repeat(lineWidth) + '\n';

    // Init
    push(0x1B, 0x40);

    // Header
    push(0x1B, 0x61, 0x01); // Center
    push(0x1D, 0x21, 0x11); // Double size
    push(...s2b(config.empresaNombre + '\n'));
    push(0x1D, 0x21, 0x00); // Normal size
    push(...s2b('CORTE DE CAJA (Z)\n'));
    push(...s2b(`${reportData.fecha} ${reportData.hora}\n`));
    push(...s2b(hr));

    // Body
    push(0x1B, 0x61, 0x00); // Left align
    const formatLine = (label: string, value: string) => {
        return label.padEnd(lineWidth - value.length) + value + '\n';
    }
    push(...s2b(formatLine('Total Transacciones:', `${reportData.totalTransacciones}`)));
    push(...s2b('\n'));
    push(...s2b(formatLine('Total en Efectivo:', `$${reportData.totalEfectivo.toFixed(2)}`)));
    push(...s2b(formatLine('Total en Tarjeta:', `$${reportData.totalTarjeta.toFixed(2)}`)));
    push(...s2b(hr));
    
    // Total
    push(0x1B, 0x61, 0x02); // Right align
    push(0x1D, 0x21, 0x11); // Double size
    push(...s2b(`VENTA TOTAL: $${reportData.totalVentas.toFixed(2)}\n\n`));

    // Footer
    push(0x1B, 0x61, 0x01); // Center
    push(0x1D, 0x21, 0x00); // Normal size
    push(...s2b('Fin del Reporte\n'));

    // Cut
    push(0x0A, 0x0A, 0x0A, 0x0A, 0x0A);
    push(0x1D, 0x56, 0x42, 0x00);

    return new Uint8Array(commands);
};

export const printZReport = async (config: AppConfig, ventasData: Venta[]) => {
    const totalVentas = ventasData.reduce((sum, venta) => sum + venta.total, 0);
    const totalEfectivo = ventasData.filter(v => v.metodo_pago === 'efectivo').reduce((sum, v) => sum + v.total, 0);
    const totalTarjeta = ventasData.filter(v => v.metodo_pago === 'tarjeta').reduce((sum, v) => sum + v.total, 0);
    const totalTransacciones = ventasData.length;
    const now = new Date();

    const reportData = {
        totalVentas,
        totalEfectivo,
        totalTarjeta,
        totalTransacciones,
        fecha: now.toLocaleDateString('es-ES'),
        hora: now.toLocaleTimeString('es-ES'),
    };

    if (config.printerType === 'escpos' && printer.isConnected) {
        const commands = generateZReportCommands({ ...reportData, empresaNombre: config.empresaNombre }, config);
        // We need a way to send raw commands. Let's add sendCommand to the class and use it.
        // For now, let's create a temporary method inside the printer class for this.
        // It's cleaner to expose a method.
        await (printer as any).sendCommand(commands);
    } else {
        printZReportBrowser(config, ventasData);
    }
};