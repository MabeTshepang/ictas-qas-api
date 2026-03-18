import { Request, Response } from 'express';
import { hashPassword } from "../config/auth";
import prisma from "../config/db";
import { createUserSchema } from "../schemas/user.schema";

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
        tenantId: data.tenantId,
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
    // Moderators see everyone, Admins see their tenant
    where: role === 'MODERATOR' ? {} : { tenantId },
    select: { 
      id: true, 
      email: true, 
      role: true, 
      createdAt: true,
      fullName: true,
      tenant: { select: { name: true } } // Joins the tenant name
    }
  });
  res.json(users);
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, role: targetRole } = req.body;
  const { tenantId, role } = (req as AuthRequest).user;

  try {
    // In Prisma, we use 'update' with a composite where clause if possible, 
    // or verify existence first.
    const user = await prisma.user.update({
      where: { 
        id,
        // Isolation: Admins can't update users outside their tenant
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
  // Extract userId and tenantId from the auth middleware
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
      take: 50, // Limit to the last 50 entries for the dashboard view
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