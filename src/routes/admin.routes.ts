import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { 
  getDashboardStats, 
  getLogs, 
} from '../controllers/admin.controller';
import { createUser, deleteUser, getAllUsers, updateUser } from '../controllers/user.controller';

const router = Router();

// Apply Auth and Admin role to all routes in this file
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Dashboard Metrics
router.get('/stats', getDashboardStats);
router.get('/logs', getLogs);

// User Management CRUD
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

export default router;