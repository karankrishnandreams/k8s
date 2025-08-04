import { Types } from 'mongoose';

export interface ISalesItem {
  item: Types.ObjectId;
  quantity: number;
  manufacturerId: Types.ObjectId;
  saleCostCAD?: number;
  saleCostUSD?: number;
  saleExtendedCostCAD?: number;
  saleExtendedCostUSD?: number;
  serialNumber?: string;
  condition?: Types.ObjectId;
  lineNumber: number;
  // Additional fields
  sn?: string;
  CLEI?: boolean;
  bulk?: boolean;
  nonInventory?: boolean;

  listPriceCAD?: number;
  unitPriceCAD?: number;
  extendedPriceCAD?: number;
  estUnitCostCAD?: number;
  extCostCAD?: number;

  listPrice?: number;
  unitPrice?: number;
  extendedPrice?: number;
  estUnitCost?: number;
  extCost?: number;

  taxable?: boolean;
  taxAuthority?: string;
  taxAuthorityPrice?: string;
  taxRate?: number;

  local1?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  local2?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  local3?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  local4?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  tax5?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  tax6?: {
    goodscategory: string;
    taxRate?: number;
  } | null;

  reference?: string;
  warehouseId?: Types.ObjectId;
  location?: string;
  salesDistribution?: string;
  harmonizedSystem?: string;
  selectedInventoryId?: string;
  associatedItem?: string;
  description?: string;
  extendedDescription?: string | null;
  inventory?: string;
  status?: string;

  cost?: number;
  grossMargin?: number;
  commissionCost?: number;
  commissionPercentage?: number;
  repSellerMargin?: number;
  buyerMargin?: number;
  supplierMargin?: number;

  internalComments?: string;
  commentsToCustomer?: string;
}// adjust path as needed

export interface ISales {
  userId: Types.ObjectId;
  spId?: Types.ObjectId;
  companyId: Number;
  client?: Types.ObjectId;
  currency?: Types.ObjectId;
  terms: Types.ObjectId;
  // country?: Types.ObjectId;
  // state?: Types.ObjectId;
  // city?: Types.ObjectId;
  // wareHouse?: Types.ObjectId;
  tax?: Types.ObjectId;

  date: Date;
  saleDate?: Date;
  shipDate?: Date;
  invoicedDate?: Date;
  promiseDate?: Date;

  so?: string;
  sp?: string;
  saleType: 'sp' | 'so';
  status: 'Open' | 'Closed' | 'Voided' | 'Partial' | 'Reserved' | 'Invoiced';
  // isSaleOrder?: boolean;
  isConverted: boolean;
  isActive: boolean;
  deletedAt?: Date | null;

  items?: ISalesItem[];

  description?: string;
  extDescription?: string;
  internalComment?: string;
  commentToVendor?: string;
  address?: string;
  storeFront?: string;
  invoiceDistribution?: string;
  unitSerialNo?: string;

  rep?: Types.ObjectId;
  // condition?: Types.ObjectId;
  hidePricing?: boolean;
  ledgerCVCode?: string;
  companyMask?: string;

  probabilityFactor?: number;
  valid?: number;
  voided?: string;

  totalForeignamount?: number;
  totalPrice?: number;
  subTotal?: number;
  total?: number;
  extendedCost?: number;
  freight?: number;
  extraCost?: number;
  insallation?: number;
  miscCharge?: number;
  deposits?: number;
  taxPrice?: number;
  grossMargin?: number;
  grossMarginPercentage?: number;
  CAD?: number;

  // vendorSO?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
