import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import seedRoutes from './seed.routes';
import healthCheckRoutes from './healthCheck.routes';
import { verifyInternalToken } from '@middlewares/verifyInternalToken'; 
import rolesRoutes from './roles.routes' ; 

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
router.use('/user', userRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Seed routes
router.use('/seed', seedRoutes);  





export default router;
