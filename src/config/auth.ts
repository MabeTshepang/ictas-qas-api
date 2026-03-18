import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};
export const generateToken = (payload: object) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
};