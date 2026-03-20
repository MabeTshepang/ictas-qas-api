import { Request, Response } from 'express';
import { generateToken, hashPassword, verifyPassword } from '../config/auth';
import prisma from '../config/db';
import { loginSchema, updatePasswordSchema } from '../schemas/user.schema';
import * as crypto from 'node:crypto';
import { sendEmail } from '../services/email.service';

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

export const requestReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Security: Always return success even if user doesn't exist to prevent email harvesting
  if (!user) {
    return res.json({ message: "If an account exists, a reset link has been sent." });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  await prisma.passwordReset.create({
    data: { token, userId: user.id, expiresAt, tenantId: user.tenantId }
  });

  // Build the link using your .env variable
  const resetLink = `${process.env.FRONTEND_URL}/${user.tenantId}/reset-password?token=${token}`;

  await sendEmail({
      to: user.email,
      subject: "Reset Your Password - ICTAS",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.fullName},</p>
          <p>You requested to reset your password. Click the button below to set a new one:</p>
          <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;" />
          <p style="font-size: 12px; color: #666;">This link will expire in 1 hour.</p>
        </div>
      `
    });

  res.json({ message: "Reset link sent successfully." });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!resetRecord || resetRecord.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired token." });
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: hashedPassword }
    }),
    prisma.passwordReset.delete({ where: { token } })
  ]);

  res.json({ message: "Password updated successfully. You can now log in." });
};