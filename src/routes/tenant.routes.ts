import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getPublicTenants, getAllTenants, getModDashboardStats, createTenant, deleteTenant, updateTenant, getAllTenantLogs } from '../controllers/tenant.controller';
import multer from 'multer';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});
router.use(authenticate);

router.get('/logs', authenticate, authorize(['MODERATOR', 'ADMIN']), getAllTenantLogs);

router.use(authorize(['MODERATOR']));

router.get('/all', authenticate, authorize(['MODERATOR']), getAllTenants);
router.get('/stats', authenticate, authorize(['MODERATOR']), getModDashboardStats);

router.post('/', upload.single('file'), createTenant);
router.patch('/:id', upload.single('file'), updateTenant);
router.delete('/:id', deleteTenant);

export default router;