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
router.use(authenticate);

router.patch('/user/password', updatePassword);

router.post('/upload', upload.single('file'), handleUpload);
router.post('/logs/:logId/re-email', reEmailLog);
router.patch('/logs/:logId', updateLog);

router.get('/files', getFiles);
router.get('/files/:id', getFileDetails);
router.get('/my-logs', getMyLogs); 
router.post('/logs', createLog);

router.delete('/files/:id', authorize(['ADMIN']), deleteFileRecord);

export default router;