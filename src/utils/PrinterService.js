/**
 * Safe Printer Service for tab software
 */
let BLEPrinter = null;
try {
  const p = require('react-native-thermal-receipt-printer-image-qr');
  if (p && p.BLEPrinter) {
    BLEPrinter = p.BLEPrinter;
  }
} catch (e) {
  console.log('PrinterService: Native module load failed.');
}

const mockPrinter = {
  init: () => Promise.resolve(),
  getDeviceList: () => Promise.resolve([]),
  connectPrinter: (addr) => {
    console.warn('MockPrinter: Connection attempt to', addr);
    return Promise.reject(new Error('Native printer module not loaded'));
  },
  closeConn: () => Promise.resolve(),
  printText: (text) => { console.log('Mock Print:', text); return Promise.resolve(); },
  printQRCode: (data) => Promise.resolve(),
  cutPaper: () => Promise.resolve(),
};

const Service = BLEPrinter || mockPrinter;

// Add a safe print wrapper to prevent crashes
export const safePrint = async (text) => {
  if (!Service.printText) return;
  try {
    const printPromise = Service.printText(text);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Print timeout')), 5000));
    await Promise.race([printPromise, timeoutPromise]);
    return true;
  } catch (e) {
    console.error('SafePrint Error:', e);
    throw e;
  }
};

export { Service as PrinterService };
export const isNativePrinter = !!BLEPrinter;
export default Service;
