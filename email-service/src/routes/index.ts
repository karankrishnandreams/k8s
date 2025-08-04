import { Router } from 'express';
import emailRoutes from './email.routes';
import imapRoutes from './imap.routes';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    service_name: process.env.EMAILSERVICE_NAME,
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});


// Email routes
router.use('/mail', emailRoutes);

// IMap routes
router.use('/email', imapRoutes);

export default router;
