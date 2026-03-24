import { Request, Response } from 'express';
import { hashPassword } from "../config/auth";
import prisma from "../config/db";
import { createUserSchema } from "../schemas/user.schema";
import { sendEmail } from '../services/email.service';
import z from 'zod';

interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
}
export const createUser = async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const { tenantId: userTenantId, role: userRole } = (req as AuthRequest).user;

    if (userRole !== 'MODERATOR' && data.tenantId !== userTenantId) {
      return res.status(403).json({ error: "Tenant mismatch permissions" });
    }

    const newUser = await prisma.user.create({
      data: { 
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId || "",
        passwordHash: await hashPassword("Password123")
      },
      select: { 
        id: true, 
        fullName: true,
        email: true, 
        role: true, 
        tenantId: true 
      }
    });

    res.status(201).json(newUser);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  const { tenantId, role } = (req as AuthRequest).user;

  const users = await prisma.user.findMany({
    where: role === 'MODERATOR' ? {} : { tenantId },
    select: { 
      id: true, 
      email: true, 
      role: true, 
      createdAt: true,
      fullName: true,
      tenant: { select: { name: true } } 
    }
  });
  res.json(users);
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, role: targetRole } = req.body;
  const { tenantId, role } = (req as AuthRequest).user;

  try {

    const user = await prisma.user.update({
      where: { 
        id,
        ...(role !== 'MODERATOR' ? { tenantId } : {}) 
      },
      data: { email, role: targetRole }
    });
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(404).json({ error: "User not found or access denied" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tenantId, role } = (req as AuthRequest).user;

  try {
    await prisma.user.delete({
      where: { 
        id,
        ...(role !== 'MODERATOR' ? { tenantId } : {}) 
      }
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: "Deletion failed" });
  }
};

export const getMyLogs = async (req: Request, res: Response) => {
  const { id: userId, tenantId } = (req as any).user;

  try {
    const logs = await prisma.log.findMany({
      where: {
        userId: userId,    
        tenantId: tenantId, 
        action: "File Upload" 
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    res.json(logs);
  } catch (error) {
    console.error("GET_MY_LOGS_ERROR:", error);
    res.status(500).json({ error: "Failed to fetch your activity logs." });
  }
};

export const updateLog = async (req: Request, res: Response) => {
  const { logId } = req.params;
  const { status, action, metadata, filePath } = req.body;
  const user = (req as any).user;

  try {
    const existingLog = await prisma.log.findUnique({
      where: { id: logId }
    });

    if (!existingLog) {
      return res.status(404).json({ error: "Log entry not found" });
    }

    if (user.role !== 'MODERATOR' && existingLog.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Unauthorized: You cannot modify logs from another tenant" });
    }

    const updatedLog = await prisma.log.update({
      where: { id: logId },
      data: {
        status: status ?? existingLog.status,
        action: action ?? existingLog.action,
        metadata: metadata ?? existingLog.metadata,
        filePath: filePath ?? existingLog.filePath,
      }
    });

    res.json({ message: "Log updated successfully", log: updatedLog });
  } catch (error: any) {
    console.error("UPDATE_LOG_ERROR:", error.message);
    res.status(500).json({ error: "Failed to update log entry" });
  }
};

export const inviteModerator = async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const { tenantId: requesterTenantId, role: requesterRole } = (req as AuthRequest).user;

    if (requesterRole !== 'MODERATOR') {
      return res.status(403).json({ error: "Access denied" });
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await hashPassword(tempPassword);

    const newMod = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        role: 'MODERATOR', 
        tenantId: requesterTenantId,
        passwordHash: passwordHash
      },
      select: { id: true, fullName: true, email: true, role: true }
    });

    await sendEmail({
      to: newMod.email,
      subject: "Action Required: Your ICTAS QAS Moderator Account",
      html: `
        <div style="font-family: sans-serif;">
          <h2>Welcome to the Platform Team, ${newMod.fullName}</h2>
          <p>An administrator has created a moderator account for you.</p>
          <p><strong>Your Temporary Password:</strong> ${tempPassword}</p>
          <p>To get started, please go to the login page</p>
          <p></p>
          <p style="font-size: 12px; color: #666;">Authorized Personnel Only.</p>
        </div>
      `
    });    
    res.status(201).json(newMod);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') 
      });
    }
    res.status(400).json({ error: error.message });
  }
};
export const getAllModerators = async (req: Request, res: Response) => {
  try {
    const { tenantId, role } = (req as AuthRequest).user;

    if (role !== 'MODERATOR') return res.status(403).json({ error: "Forbidden" });

    const moderators = await prisma.user.findMany({
      where: { 
        role: 'MODERATOR',
        tenantId: tenantId
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
      }
    });

    res.json(moderators);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch moderators." });
  }
};

export const removeModerator = async (req: Request, res: Response) => {
  try {
    const { id: targetId } = req.params;
    const { id: requesterId, tenantId, role } = (req as AuthRequest).user;

    if (role !== 'MODERATOR') return res.status(403).json({ error: "Unauthorized" });

    if (targetId === requesterId) {
      return res.status(400).json({ error: "Cannot remove yourself." });
    }

    await prisma.user.delete({
      where: { 
        id: targetId,
        role: 'MODERATOR',
        tenantId: tenantId
      }
    });

    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: "Moderator not found in your organization." });
  }
};