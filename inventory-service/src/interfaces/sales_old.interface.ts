import { Types } from "mongoose";

export interface ISalesItem {
  sn: string,
  itemId: Types.ObjectId;
  manufacturerId: Types.ObjectId;
  quantity: number;
  CLEI:boolean;
  bulk:boolean;
  nonInventory:boolean;
  listPriceCAD: number;
  unitPriceCAD: number;
  extendedPriceCAD: number;
  estUnitCostCAD: number;
  extCostCAD: number;

  listPrice: number;
  unitPrice: number;
  extendedPrice: number;
  estUnitCost: number;
  extCost: number;

  taxable: boolean;
  taxAuthority: boolean;
  taxRate: number;

  local1: { goodscategory: Types.ObjectId; taxRate: number } | null;
  local2: { goodscategory: Types.ObjectId; taxRate: number } | null;
  local3: { goodscategory: Types.ObjectId; taxRate: number } | null;
  local4: { goodscategory: Types.ObjectId; taxRate: number } | null;
  tax5: { goodscategory: Types.ObjectId; taxRate: number } | null;
  tax6: { goodscategory: Types.ObjectId; taxRate: number } | null;

  conditionId: Types.ObjectId;
  reference?: string | null;
  warehouseId: Types.ObjectId;
  location: string;
  salesDistribution: Types.ObjectId;
  serialNumber?: string | null;
  harmonizedSystem?: string | null;
  selectedInventoryId?: string | null;
  associatedItem: string;
  description: string;
  extendedDescription?: string | null;
  inventory?: string | null;

  cost: number;
  grossMargin: number;
  commissionCost: number;
  commissionPercentage: number;
  repSellerMargin: number;
  buyerMargin: number;
  supplierMargin: number;

  internalComments: string;
  commentsToCustomer: string;

  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISales {
  sn: String,
  saleDate: Date;
  clientId: Types.ObjectId;
  termsId: Types.ObjectId;
  conditionId: Types.ObjectId;
  repId: Types.ObjectId;
  hidePricing: boolean;
  currencyId: Types.ObjectId;
  ledgerCVCode?: string | null;
  promiseDate: Date;
  companyMask: string;
  description: string;
  status: "Open";
  invoicedDate?: Date | null;
  unitSerialNo?: string | null;
  storeFront?: string | null;
  invoiceDistribution: string;
  probabilityFactor?:Number | null;
  isSaleOrder?: Boolean | true;
  so?:string|null;
  totalPrice: number;
  valid?:Number | null;
  voided?:string | null;
  subTotal?: Number | null;
  CAD?: Number | null;
  fright: number;
  insallation: number;
  miscCharge: number;
  deposits: number;
  tax: number;
  total: number;
  grossMargin: number;
  grossMarginPercentage: Number;

  items: ISalesItem[];

  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
