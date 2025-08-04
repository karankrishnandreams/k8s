export interface TokenPayload {
  id: string;
  role: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  countryCode?: string;
  isEmailVerified?: boolean;
  onboarding_status: boolean;
}

export interface RefreshTokenPayload extends TokenPayload {}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}


import { Secret } from 'jsonwebtoken';

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    id: string;
    role?: string;
  }
}

export interface TokenPayload {
  id: string;
}

export interface InternalTokenPayload {
  service: string;
  timestamp: number;
}

export interface TokenConfig {
  secret: Secret;
  expiresIn?: string | number;
}
