import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { 
  getDashboardStats, 
  getLogs, 
} from '../controllers/admin.controller';
import { createUser, deleteUser, getAllModerators, getAllUsers, inviteModerator, removeModerator, updateUser } from '../controllers/user.controller';

const router = Router();

// Apply Auth and Admin role to all routes in this file
router.use(authenticate);
router.use(authorize(['ADMIN', 'MODERATOR']));

// Dashboard Metrics
router.get('/stats', getDashboardStats);
router.get('/logs', getLogs);

// User Management CRUD
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/moderator/users', getAllModerators);    
router.post('/moderator/users', inviteModerator);      
router.delete('/moderator/users/:id', removeModerator);
export default router;