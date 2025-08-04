import jwt, { SignOptions } from 'jsonwebtoken';
import { TokenPayload, RefreshTokenPayload, Tokens } from '../types/jwt';
import logger from '@utils/logger';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Type-safe environment configuration
const getJwtConfig = () => {
  const {
    JWT_SECRET,
    JWT_EXPIRES_IN = '1h',//0000
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN = '7d',
  } = process.env;

  if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
  if (!REFRESH_TOKEN_SECRET) throw new Error('REFRESH_TOKEN_SECRET is required');

  return {
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN,
    refreshSecret: REFRESH_TOKEN_SECRET,
    refreshExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  };
};

const { jwtSecret, jwtExpiresIn, refreshSecret, refreshExpiresIn } = getJwtConfig();

/**
 * Generate JWT access token with proper typing
 */
export const generateToken = (payload: TokenPayload): string => {
  // Create options with correct typing
  const options: SignOptions = {
    expiresIn: jwtExpiresIn as any, // Explicit type assertion
  };

  return jwt.sign(payload, jwtSecret, options);
};

/**
 * Generate refresh token with proper typing
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: refreshExpiresIn as any, // Explicit type assertion
  };

  return jwt.sign(payload, refreshSecret, options);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, jwtSecret) as TokenPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, refreshSecret) as RefreshTokenPayload;
};

/**
 * Refresh token pair
 */
export const refreshTokens = (refreshToken: string): Tokens => {
  const payload = verifyRefreshToken(refreshToken);

  const accessToken = generateToken(payload); // Reuse all fields
  const newRefreshToken = generateRefreshToken(payload); // Optional: rotate token

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};


export const readJSONFile = (filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading or parsing the file:', error);
    return null;
  }
};