import { Request, Response } from 'express';
import { generateToken, hashPassword, verifyPassword } from '../config/auth';
import prisma from '../config/db';
import { loginSchema, updatePasswordSchema } from '../schemas/user.schema';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { tenant: true } 
    });
    
    // Ensure verifyPassword matches your actual utility name
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.tenant.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Tenant account is inactive' });
    }

    const token = generateToken({ id: user.id, role: user.role, tenantId: user.tenantId });

    res.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant: user.tenant,
        fullName: user.fullName
      }
    });
  } catch (error: any) {
    console.error("LOGIN_ERROR:", error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  const userContext = (req as any).user;
  
  try {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: userContext.id } });
    
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
      return res.status(400).json({ error: 'Current password incorrect' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};