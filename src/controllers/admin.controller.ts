import { Request, Response } from 'express';
import prisma from '../config/db';
import { startOfDay } from 'date-fns';
import { downloadFromAzure } from '../services/azure-storage.service';
import { Resend } from 'resend';
import { getTenantInfo } from './tenant.controller';

const resend = new Resend(process.env.RESEND_API_KEY);
// Custom Request Interface
interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
}

// --- DASHBOARD & LISTING (READ) ---

export const getFiles = async (req: Request, res: Response) => {
  const { tenantId, role, id: userId } = (req as AuthRequest).user;

  try {
    const files = await prisma.log.findMany({
      where: {
        // MODERATORS see everything; ADMINS/USERS see only their tenant
        ...(role !== 'MODERATOR' ? { tenantId } : {}),
        ...(role === 'USER' ? { userId } : {})
      },
      include: {
        tenant: { select: { name: true } } // Added so we know which tenant the log belongs to
      },
      orderBy: { createdAt: 'desc' }, // Changed from timestamp to createdAt
      take: 50 
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Could not retrieve file logs' });
  }
};

/**
 * Fetches all registered tenants (BAMB, ZAMACE, etc.)
 * Filters out the 'MODERATOR' tenant to keep the list focused on clients.
 */

export const getDashboardStats = async (req: Request, res: Response) => {
  const { tenantId, role } = (req as any).user;
  const todayStart = startOfDay(new Date());

  try {
    // Determine filter based on role
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

    /**
     * Helper to map Prisma group results to our specific interface keys.
     * Maps 'Sent' -> emailed, 'Failed' -> failed, etc.
     */
    const mapStats = (statsArray: any[]) => {
      const getVal = (status: string) => 
        statsArray.find(s => s.status === status)?._count._all || 0;

      const emailed = getVal('Sent');
      const failed = getVal('Failed');
      const pending = getVal('Pending');
      
      return {
        uploaded: emailed + failed + pending, // Total uploads is the sum of all statuses
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

// --- LOG/FILE MANAGEMENT (CRUD) ---

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
    // 1. Find the log entry and verify ownership/tenant
    const log = await prisma.log.findFirst({
      where: { id: logId, tenantId: user.tenantId }
    });

    if (!log || !log.filePath) {
      return res.status(404).json({ error: "Log or file record not found" });
    }

    // 2. Download the encrypted buffer from Azure
    const fileBuffer = await downloadFromAzure(log.filePath);
    const tenant = await getTenantInfo(user.tenantId);
    

    // 3. Resolve Recipients (Using the same logic as your upload)
    const receiver = process.env.RECEIVER_EMAIL; 
    const fileName = log.filePath.split('/').pop() || 'document.pdf';

    // 4. Re-send via Resend
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

    // 5. Update the log status to "Sent"
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

  // Basic Validation
  if (!action || !status) {
    return res.status(400).json({ error: "Action and Status are required fields." });
  }

  try {
    const newLog = await prisma.log.create({
      data: {
        action,
        status, // e.g., 'Sent', 'Failed', 'Pending'
        filePath: filePath || null,
        metadata: metadata || {}, // Any extra JSON data
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
    // If Moderator, show all logs. If Admin/User, show only their tenant's logs.
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
      take: 100 // Limit to latest 100 for performance
    });

    res.json(logs);
  } catch (error) {
    console.error("FETCH_LOGS_ERROR:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

