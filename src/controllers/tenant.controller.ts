import { Request, Response } from 'express';
import prisma from '../config/db';
import { uploadBrandingToAzure } from '../services/azure-storage.service';
import path from 'path';
import { uploadToImageKit } from '../services/imagekit.service';
import { hashPassword } from '../config/auth';

interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
}
export const getTenantInfo = async (tenantId: string) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        fileSlug: true,
      },
    });

    if (!tenant) throw new Error("Tenant context not found");
    return tenant;
  } catch (error) {
    console.error("GET_TENANT_INFO_ERROR:", error);
    throw error;
  }
};
export const getAllTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        type: {
          not: 'MODERATOR'
        }
      },
      select: {
        id: true,
        name: true,
        subtitle: true,
        status: true,
        type: true,
        branding: true,
        createdAt: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(tenants);
  } catch (error: any) {
    console.error('GET_TENANTS_ERROR:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tenants', 
      message: error.message 
    });
  }
};
export const getAllTenantLogs = async (req: Request, res: Response) => {
  const { tenantId, role } = (req as AuthRequest).user;

  try {
    const logs = await prisma.log.findMany({
      where: {
        ...(role !== 'MODERATOR' ? { tenantId } : {}),
        action: "File Upload"
      },
      include: {
        user: {
          select: { fullName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenant activity." });
  }
};
export const getPublicTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        type: 'NORMAL' 
      },
      select: {
        id: true,
        name: true,
        subtitle: true,
        branding: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(tenants);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getModDashboardStats = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    const logStats = await prisma.log.groupBy({
      by: ['tenantId', 'status'],
      _count: {
        id: true
      },
      where: {
        action: 'File Upload'
      }
    });

    const totalEvents = await prisma.log.count();

    const formattedStats = tenants.map(tenant => {
      const tenantLogs = logStats.filter(l => l.tenantId === tenant.id);
      
      return {
        tenantId: tenant.id,
        name: tenant.name,
        userCount: tenant._count.users,
        uploadCount: tenantLogs.reduce((acc, curr) => acc + curr._count.id, 0),
        pendingCount: tenantLogs.find(l => l.status === 'Pending')?._count.id || 0,
        failedCount: tenantLogs.find(l => l.status === 'Failed')?._count.id || 0,
        sentCount: tenantLogs.find(l => l.status === 'Sent')?._count.id || 0,
      };
    });

    res.json({
      tenants: formattedStats,
      totalEvents
    });
  } catch (error: any) {
    console.error("STATS_ERROR:", error.message);
    res.status(500).json({ error: "Failed to compile platform statistics" });
  }
};

export const createTenant = async (req: Request, res: Response) => {
const { name, overlayColor, adminName, adminEmail } = req.body;
const file = req.file;

try {
    if (!file) return res.status(400).json({ error: "Branding image is required" });
    if (!adminName || !adminEmail) {
    return res.status(400).json({ error: "Initial admin details (name/email) are required" });
    }

    const imageKey = await uploadToImageKit(file.buffer, file.originalname);

    const result = await prisma.$transaction(async (tx) => {

    const tenant = await tx.tenant.create({
        data: {
        name,
        branding: JSON.stringify({ imageKey, overlayColor }),
        fileSlug: ""
        }
    });

    const newUser = await tx.user.create({
        data: { 
        fullName: adminName,
        email: adminEmail.toLowerCase().trim(),
        role: 'ADMIN', 
        tenantId: tenant.id, 
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

    return { tenant, admin: newUser };
    });

    res.status(201).json({
    message: "Tenant created successfully",
    tenant: result.tenant,
    admin: result.admin
    });

} catch (error: any) {
    console.error("PROVISIONING_ERROR:", error);

    if (error.code === 'P2002') {
    return res.status(400).json({ error: "A user with this email address already exists." });
    }

    res.status(500).json({ error: error.message || "Failed to provision tenant resources" });
}
};

export const updateTenant = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, overlayColor } = req.body;
  const file = req.file;

  try {
    let updateData: any = { name };
    
    if (file) {
      const fileName = `branding/${id}_bg_${Date.now()}.jpg`;
      const imageKey = await uploadBrandingToAzure(file.buffer, fileName);
      updateData.branding = {
        imageKey,
        overlayColor: overlayColor
      };
    } else if (overlayColor) {
        const current = await prisma.tenant.findUnique({ where: { id } });
        const existingBranding = JSON.parse((current?.branding as string) || '{}');
        updateData.branding = JSON.stringify({
        ...existingBranding,
        overlayColor
        });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Update failed" });
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  const { id: tenantId } = req.params;

  try {
    await prisma.$transaction([
      prisma.log.deleteMany({ where: { tenantId } }),

      prisma.user.deleteMany({ where: { tenantId } }),

      prisma.passwordReset.deleteMany({ where: { user: { tenantId } } }),

      prisma.tenant.delete({ where: { id: tenantId } }),
    ]);

    res.json({ 
      message: "Tenant and all associated users and logs have been purged successfully." 
    });
  } catch (error: any) {
    console.error("DELETE_TENANT_ERROR:", error);
    res.status(500).json({ 
      error: "Failed to delete tenant. An internal error occurred during the purge." 
    });
  }
};