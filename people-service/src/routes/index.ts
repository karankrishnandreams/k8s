import { Router } from 'express';
import healthCheckRoutes from './healthCheck.routes';
import { verifyInternalToken } from '@middlewares/verifyInternalToken'; 
import customerRouter from './customer.routes'
import warehouseRouter from './warehouse.routes'
const router = Router();

// Add this to your clinic-service routes
router.get('/health', (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    service_name: process.env.PEOPLESERVICE_NAME,
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

router.use('/customer',customerRouter)
router.use('/warehouse',warehouseRouter)



export default router;
