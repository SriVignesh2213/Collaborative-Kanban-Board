import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_for_development_12948712398';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Check auth header or query param (for sockets fallback if needed)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token is required' });
    return;
  }

  jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
    if (err || !decoded || typeof decoded !== 'object') {
      res.status(403).json({ error: 'Invalid or expired access token' });
      return;
    }

    req.user = {
      id: (decoded as any).id,
      email: (decoded as any).email,
      name: (decoded as any).name,
    };
    next();
  });
};
