import { Request, Response } from 'express';
import prisma from '../config/db';
import { uploadBrandingToAzure } from '../services/azure-storage.service';
import path from 'path';
import { uploadToImageKit } from '../services/imagekit.service';

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
        // Optional: Count users in each tenant for the moderator dashboard
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
export const getPublicTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        type: 'NORMAL' // We still exclude MODERATOR so the public doesn't see the "Admin Console" option
      },
      select: {
        id: true,
        name: true,
        subtitle: true,
        branding: true, // Needed for the login page background/colors
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
    // 1. Fetch all tenants to ensure we have names
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    // 2. Aggregate Log Data (Uploads, Pending, Failed)
    // We group by tenantId and status to get counts for each category
    const logStats = await prisma.log.groupBy({
      by: ['tenantId', 'status'],
      _count: {
        id: true
      },
      where: {
        action: 'File Upload' // Only count file-related events
      }
    });

    // 3. Get Total Security Events (Logins, failures, etc. across platform)
    const totalEvents = await prisma.log.count();

    // 4. Format the data for the Frontend table
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
  const { name, overlayColor } = req.body;
  const file = req.file;

  try {
    if (!file) return res.status(400).json({ error: "Branding image is required" });

    const tempSlug = name.toLowerCase().trim().replace(/\s+/g, '-');
    
    // Get the extension from the original file (e.g., .jpg)
    const extension = path.extname(file.originalname); 
    
    // Create a full filename with the extension
    const fullFileName = `${tempSlug}_bg${extension}`;

    // Pass the full filename to Azure
    const imageKey = await uploadToImageKit(file.buffer, file.originalname);
    const newTenant = await prisma.tenant.create({
      data: {
        name,
        branding: {
          imageKey,
          overlayColor: overlayColor || "from-slate-900/80 to-black/80",
        }
      }
    });

    res.status(201).json(newTenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. UPDATE TENANT
export const updateTenant = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, overlayColor } = req.body;
  const file = req.file;

  try {
    let updateData: any = { name };
    
    // If a new image is uploaded, process it
    if (file) {
      const fileName = `branding/${id}_bg_${Date.now()}.jpg`;
      const imageKey = await uploadBrandingToAzure(file.buffer, fileName);
      updateData.branding = {
        imageKey,
        overlayColor: overlayColor
      };
    } else if (overlayColor) {
      // Update only color if no file
      const current = await prisma.tenant.findUnique({ where: { id } });
      updateData.branding = {
        ...(current?.branding as object),
        overlayColor
      };
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

// 4. DELETE TENANT
export const deleteTenant = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Note: This will fail if there are Users/Logs linked (Foreign Key constraint)
    await prisma.tenant.delete({ where: { id } });
    res.json({ message: "Tenant deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Delete failed. Ensure tenant has no active users." });
  }
};