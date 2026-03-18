import { Request, Response } from 'express';
import prisma from '../config/db';

interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    tenantId: string;
  };
}

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