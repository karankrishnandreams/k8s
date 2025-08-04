const sampleData = {
  Sales: [
    {
      sn: 123443,
      saleDate: "2025-07-01T00:00:00.000Z",
      clientId: "XYZ Corporation",
      termsId: "Net 30",
      conditionId: "New",
      repId: "Jane Smith",
      currencyId: "USD",
      promiseDate: "2025-07-15T00:00:00.000Z",
      status: "Open",
      storeFront: "Main Store",
      ledgerCVCode: "LCV123",
      companyMask: "CMP001",
      description: "Updated sale description",
      hidePricing: false,
      invoicedDate: "2025-07-20T00:00:00.000Z",
      unitSerialNo: "SER123456",
      invoiceDistribution: "Email",

      totalPrice: "1500.00",
      fright: "50.00",
      installation: "100.00",
      miscCharge: "20.00",
      deposits: "200.00",
      tax: "180.00",
      total: "1650.00",
      grossMargin: "300.00",
      grossMarginPercentage: 10
    }
  ],
  Items: [
    {
      sn: 123443,
      itemId: "Item description here",
      manufacturerId: "Sony",
      CLEI: false,
      bulk: false,
      nonInventory: true,
      quantity: 10,

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

      local1: {
        goodscategory: "Electronics",
        taxRate: 2.00
      },
      local2: null,
      local3: null,
      local4: null,
      tax5: null,
      tax6: null,

      conditionId: "New",
      reference: "REF-001",
      warehouseId: "Main Warehouse",
      location: "Aisle 4",
      salesDistribution: "Retail",
      serialNumber: "SN-1001",
      harmonizedSystem: "HS2025",
      selectedInventoryId: "INV-001",
      associatedItem: "ASSOC-123",
      description: "Item description here",
      extendedDescription: "Optional extended description",
      inventory: "INV-001",

      cost: 3000.00,
      grossMargin: 250.00,
      commissionCost: 50.00,
      commissionPercentage: 5.00,
      repSellerMargin: 10.00,
      buyerMargin: 8.00,
      supplierMargin: 7.00,
      internalComments: "Internal note about this item",
      commentsToCustomer: "Visible note for customer"
    }
  ]
};

export { sampleData };
