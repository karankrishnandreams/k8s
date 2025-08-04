import moment from 'moment';

export const generateInvoiceNumber = async (InvoiceModel: any): Promise<string> => {
  const currentYear = moment().format('YYYY'); // e.g., "2025"
  
  // Find latest invoice number in this year
  const lastInvoice = await InvoiceModel
    .findOne({ invoiceNumber: { $regex: `^INV-${currentYear}-` } })
    .sort({ createdAt: -1 })
    .lean();

  let nextNumber = 1;

  if (lastInvoice && lastInvoice.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split('-');
    const lastSequence = parseInt(parts[2], 10); // get "0001" part
    if (!isNaN(lastSequence)) nextNumber = lastSequence + 1;
  }

  const padded = String(nextNumber).padStart(4, '0'); // e.g., "0002"
  return `INV-${currentYear}-${padded}`;
};
