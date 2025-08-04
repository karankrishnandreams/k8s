import { Type } from "@aws-sdk/client-s3";
import { Types } from "mongoose";

export interface IPurchaseItem {
  item: Types.ObjectId;
  // manufacturer: Types.ObjectId;
  quantity: number;
  purchaseCostCAD?: number;
  purchaseCostUSD?: number;
  extendedCostCAD?: number;
  extendedCostUSD?: number;
  serialNumber?: string;
  condition: Types.ObjectId;
  lineNo: number;
  // status?: string;
  wareHouse: Types.ObjectId;
  location?: string;
  // countryOfOrigin?: string;
  // associatedNumber?: string;
  // clei?: boolean;
  // bulk?: boolean;
  // nonInventory?: boolean;
  // weight?: number;
  // originalUnitCost?: number;
  // unitCost?: number;
  // taxable?: boolean;
  // taxAuthorityTaxable?: boolean;
  // taxAuthority?: string;
  // taxAuthorityTaxRate?: number;
  // local1?: string;
  // local1TaxRate?: number;
  // local2?: string;
  // local2TaxRate?: number;
  // local3?: string;
  // local3TaxRate?: number;
  // local4?: string;
  // local4TaxRate?: number;
  // tax5?: string;
  // tax5TaxRate?: number;
  // tax6?: string;
  // tax6TaxRate?: number;
  // description?: string;
  // extDescription?: string;
  // internalComment?: string;
}

export interface IPurchase {
  userId: Types.ObjectId;
  ppId?: Types.ObjectId;
  companyId: string;
  date: Date;
  vendor: Types.ObjectId;
  vendorSO?: string;
  description?: string;
  extDescription?: string;
  internalComment?: string;
  commentToVendor?: string;
  currency: Types.ObjectId;
  rep?: Types.ObjectId;
  terms: Types.ObjectId;
  // condition: Types.ObjectId;
  shipDate?: Date;
  address: String;
  country: Types.ObjectId;
  state: Types.ObjectId;
  city: Types.ObjectId;
  // wareHouse: Types.ObjectId;
  tax: Types.ObjectId;
  status: "Open" | "Approved" | "Rejected" | "Cancelled" | "Voided" | "Completed" | "Available";
  recievedStatus: "In Transit" | "Partially Received" | "Received";
  purchaseType: "pp" | "po";
  extendedCost?: number;
  taxPrice? : number | 0
  freight?: number;
  totalForeignamount?: number;
  extraCost?: number;
  subTotal?: number;
  total?: number;
  items?: IPurchaseItem[];
  deletedAt?: Date;
  po?: string;
  pp?: string;
  isActive: Boolean,
  isConverted: Boolean,
  totalQty: Number,
  receivedQty: Number,
  balanceQty: Number,
  // reference?: string;
  // hideLineItemPricing?: boolean;
  // sourcePP?: string;
  // sourceSO?: string;
  // billDistribution?: string;
  // poType?: string;
  // erasureMethod?: string;
  // workflowTemplate?: string;
  // serviceFee?: string;
  // purchaseCostTemplate?: string;
  // supplierMargin?: number;
  // prePaid?: number;
}
