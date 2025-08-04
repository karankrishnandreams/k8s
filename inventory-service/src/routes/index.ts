import { Router } from 'express';
import manufacturerRouter from './manfacturer.routes'
import categoryRoutes from './category.routes';
import itemRoutes from './item.routes';
import taxRoutes from './tax.routes';
import salesRoutes from './sales.routes';
import invoiceRoutes from './invoice.routes';
import healthCheckRoutes from './healthCheck.routes';
import { verifyInternalToken } from '@middlewares/verifyInternalToken'; 
import skuRouter from './sku.router'
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import termRoutes from '../routes/term.router';
import conditionRouter from '../routes/condition.router';
import currencyRouter from '../routes/currency.routes';
import purchaseProposalRoutes from './purchase.routes';
import counterRoutes from './counter.routes';
const router = Router();

// Add this to your clinic-service routes
router.get('/health', (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

router.use('/purchase-proposal',authenticateWithSubdomainCheck(true),purchaseProposalRoutes)

router.use('/manufacturer',manufacturerRouter);
 
// Category Routes
router.use('/category', categoryRoutes);  
router.use('/sku',skuRouter)
router.use('/terms',termRoutes)
router.use('/conditions',conditionRouter)
router.use('/currency',currencyRouter)
router.use('/item',authenticateWithSubdomainCheck(true),itemRoutes)
router.use('/sale',salesRoutes)
router.use('/tax',authenticateWithSubdomainCheck(true),taxRoutes)
router.use('/invoice',authenticateWithSubdomainCheck(true),invoiceRoutes)
router.use('/counter',counterRoutes );



export default router;
