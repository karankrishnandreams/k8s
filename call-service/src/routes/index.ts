import { Router } from 'express';
import callRoutes from './call.routes';

const router = Router();

// Add this to your clinic-service routes
router.get('/health', (req, res) => {
  // Add any additional health checks (database connection, etc)
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

// Apply it only to internal protected routes
// router.use(verifyInternalToken);

// User route
router.use('/voice', callRoutes);

export default router;
