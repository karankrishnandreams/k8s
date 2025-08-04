const sampleData = {
  sn: 123443,
  saleDate: "2025-07-01T00:00:00.000Z",
  clientId: "XYZ Corporation",
  termsId: "Net 30",
  conditionId: "New",
  repId: "Jane Smith",
  hidePricing: false,
  currencyId: "USD",
  probabilityFactor: 2,
  valid: 2,
  invoiceDistribution: "Email",
  companyMask: "CMP001",
  description: "Updated sale description",
  status: "Open",
  voided: "voided",
  promiseDate: "2025-07-15T00:00:00.000Z",
  totalPrice: "1500.00",
  fright: "50.00",
  insallation: "100.00",
  miscCharge: "20.00",
  subTotoal: "1000",
  tax: "180.00",
  total: "1650.00",
  grossMargin: "300.00",
  grossMarginPercentage: 10,
  items: [
    {
      sn: 123443,
      itemId: "Item description here",
      manufacturerId: "Sony",
      CLEI: false,
      bulk: false,
      nonInventory: true,
      quantity: 10,
      status: "Open",

      listPriceCAD: 120.00,
      unitPriceCAD: 115.00,
      extendedPriceCAD: 1150.00,
      estUnitCostCAD: 80.00,
      extCostCAD: 800.00,

      listPrice: 100.00,
      unitPrice: 95.00,
      extendedPrice: 950.00,
      estUnitCost: 70.00,
      extCost: 700.00,

      taxable: true,
      taxAuthority: "test",
      taxRate: 12.00,

      local1: { goodscategory: "Electronics", taxRate: 2.00 },
      local2: null,
      local3: null,
      local4: null,
      tax5: null,
      tax6: null,

      conditionId: "New",
      warehouseId: "Main Warehouse",
      location: "Aisle 4",
      associatedItem: "ASSOC-123",
      salesDistribution: "Retail",
      description: "Item description here",
      extendedDescription: "Optional extended description",
      internalComments: "Internal note about this item",
      commentsToCustomer: "Visible note for customer"
    }
  ]
};

export { sampleData };
