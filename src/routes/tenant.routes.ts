import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getPublicTenants, getAllTenants } from '../controllers/tenant.controller';

const router = Router();

// Publicly accessible (for login dropdowns etc)
router.get('/api/tenants/public', getPublicTenants);

// Protected Moderator access
router.get('/tenants', authenticate, authorize(['MODERATOR']), getAllTenants);

export default router;