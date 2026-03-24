import { Request, Response } from 'express';
import prisma from '../config/db';
import { startOfDay } from 'date-fns';
import { downloadFromAzure } from '../services/azure-storage.service';
import { Resend } from 'resend';
import { getTenantInfo } from './tenant.controller';

const resend = new Resend(process.env.RESEND_API_KEY);
interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
}


export const getFiles = async (req: Request, res: Response) => {
  const { tenantId, role, id: userId } = (req as AuthRequest).user;

  try {
    const files = await prisma.log.findMany({
      where: {
        ...(role !== 'MODERATOR' ? { tenantId } : {}),
        ...(role === 'USER' ? { userId } : {})
      },
      include: {
        tenant: { select: { name: true } } 
      },
      orderBy: { createdAt: 'desc' },
      take: 50 
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Could not retrieve file logs' });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  const { tenantId, role } = (req as any).user;
  const todayStart = startOfDay(new Date());

  try {
    const globalFilter = role === 'MODERATOR' ? {} : { tenantId };

    const [totalStats, todayStats] = await Promise.all([
      prisma.log.groupBy({
        by: ['status'],
        where: globalFilter,
        _count: { _all: true }
      }),
      prisma.log.groupBy({
        by: ['status'],
        where: { ...globalFilter, createdAt: { gte: todayStart } },
        _count: { _all: true }
      })
    ]);
    const mapStats = (statsArray: any[]) => {
      const getVal = (status: string) => 
        statsArray.find(s => s.status === status)?._count._all || 0;

      const emailed = getVal('Sent');
      const failed = getVal('Failed');
      const pending = getVal('Pending');
      
      return {
        uploaded: emailed + failed + pending,
        emailed,
        pending,
        failed
      };
    };

    const responseData = {
      total: mapStats(totalStats),
      today: mapStats(todayStats)
    };

    res.json(responseData);
  } catch (error: any) {
    console.error('STATS_ERROR:', error);
    res.status(500).json({ error: 'Stats aggregation failed' });
  }
};


export const getFileDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenantId, role } = (req as AuthRequest).user;

  const file = await prisma.log.findFirst({
    where: { 
      id, 
      ...(role !== 'MODERATOR' ? { tenantId } : {}) 
    },
    include: { tenant: true }
  });

  if (!file) return res.status(404).json({ error: "Record not found" });
  res.json(file);
};

export const deleteFileRecord = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenantId, role } = (req as AuthRequest).user;

  try {
    await prisma.log.delete({
      where: { 
        id, 
        ...(role !== 'MODERATOR' ? { tenantId } : {}) 
      }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: "Record not found" });
  }
};

export const reEmailLog = async (req: Request, res: Response) => {
  const { logId } = req.params;
  const user = (req as any).user;

  try {
    const log = await prisma.log.findFirst({
      where: { id: logId, tenantId: user.tenantId }
    });

    if (!log || !log.filePath) {
      return res.status(404).json({ error: "Log or file record not found" });
    }

    const fileBuffer = await downloadFromAzure(log.filePath);
    const tenant = await getTenantInfo(user.tenantId);
    

    const receiver = process.env.RECEIVER_EMAIL; 
    const fileName = log.filePath.split('/').pop() || 'document.pdf';

    const { error } = await resend.emails.send({
      from: `ICTAS ${tenant.name} <${process.env.SENDER_EMAIL}>`,
      to: [receiver || ''],
      cc: [process.env.CCRECEIVER_EMAIL || ''],
      bcc: [process.env.BCCRECEIVER_EMAIL || ''],
      subject: `ICTAS ${tenant.name} - Delivery Note`,
      html: `<strong>Find Attached ${tenant.name} Grain Assessment Form</strong>`,
      attachments: [{ filename: fileName, content: fileBuffer }],
    });

    if (error) throw new Error(error.message);

    await prisma.log.update({
      where: { id: logId },
      data: { status: 'Sent', action: 'File Upload' }
    });

    res.json({ message: "Email resent successfully" });
  } catch (err: any) {
    console.error("RE-EMAIL_ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};


export const createLog = async (req: Request, res: Response) => {
  const { tenantId, id: userId } = (req as any).user;
  const { action, status, filePath, metadata } = req.body;

  if (!action || !status) {
    return res.status(400).json({ error: "Action and Status are required fields." });
  }

  try {
    const newLog = await prisma.log.create({
      data: {
        action,
        status, 
        filePath: filePath || null,
        metadata: metadata || {},
        tenantId,
        userId
      }
    });

    res.status(201).json(newLog);
  } catch (error) {
    console.error("CREATE_LOG_ERROR:", error);
    res.status(500).json({ error: "Failed to record log entry." });
  }
};
export const getLogs = async (req: Request, res: Response) => {
  const { tenantId, role } = (req as any).user;

  try {
    const whereClause = role === 'MODERATOR' ? {} : { tenantId };

    const logs = await prisma.log.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 
    });

    res.json(logs);
  } catch (error) {
    console.error("FETCH_LOGS_ERROR:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

