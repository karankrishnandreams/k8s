import { Router } from "express";
import { getCompanyCounts, getDailySubscribersCount, getRecentlyExpiredPlans, getRecentlyRegisteredCompanies, getRecentTransactions, getRecentTransactionsWithPackage, getRevenueFromSubscriptions, getTopPackages, globalMetrics, reminderEmailForExpiry } from "../controllers/dashboard.controller"; // Adjust the path as needed
import { authenticate } from '../middlewares/authentication';

const router = Router();

router.get("/global", authenticate, globalMetrics);
router.get("/recent", authenticate, getRecentTransactions);
router.get("/recent-with-package", authenticate, getRecentTransactionsWithPackage);
router.get("/counts", authenticate, getCompanyCounts); 
router.get("/revenue", authenticate, getRevenueFromSubscriptions);
router.get("/recently-registered", authenticate, getRecentlyRegisteredCompanies);
router.get("/recently-expired", authenticate, getRecentlyExpiredPlans); 
router.get("/top", authenticate, getTopPackages);
router.get("/daily/subcribers-count",authenticate,getDailySubscribersCount)
router.post('/reminder-email/:id',reminderEmailForExpiry)

export default router;