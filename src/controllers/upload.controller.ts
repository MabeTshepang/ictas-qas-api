import { Request, Response } from 'express';
import { processAndSendPDF } from '../services/document.service';

export const handleUpload = async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  try {
    const result = await processAndSendPDF(
      req.file.buffer, 
      user, 
      req.file.originalname
    );

    res.status(200).json({ 
      message: 'Processing complete', 
      auditUrl: result.url 
    });
  } catch (error: any) {
    console.error("UPLOAD_CONTROLLER_ERROR:", error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};