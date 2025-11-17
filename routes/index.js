import { Router } from 'express';
import budgetRoutes from './budgetRoutes.js';

const router = Router();

router.use('/', budgetRoutes);
export default router;