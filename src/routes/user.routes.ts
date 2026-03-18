import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { handleUpload } from '../controllers/upload.controller';
import { reEmailLog, createLog, deleteFileRecord, getFileDetails, getFiles } from '../controllers/admin.controller';

import multer from 'multer';
import { updatePassword } from '../controllers/auth.controller';
import { updateLog, getMyLogs } from '../controllers/user.controller';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Protect all routes here
router.use(authenticate);

// Account & Profile
router.patch('/user/password', updatePassword);

// Document Pipeline (Frontend: /api/upload, /api/logs/...)
router.post('/upload', upload.single('file'), handleUpload);
router.post('/logs/:logId/re-email', reEmailLog);
router.patch('/logs/:logId', updateLog);

// Discovery
router.get('/files', getFiles);
router.get('/files/:id', getFileDetails);
router.get('/my-logs', getMyLogs); // Path: /api/my-logs
router.post('/logs', createLog);

// Admin-only cleanup within the /api/files path
router.delete('/files/:id', authorize(['ADMIN']), deleteFileRecord);

export default router;