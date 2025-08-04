export interface TokenPayload {
  id: string;
  email?: string;
  mobileNumber?: string;
  countryCode?: string;
  isEmailVerified?: boolean;
  role: string;
  iss: string;
  company_id?: string;
  userName?: string;
  accountURL?: string,
  emailSetting?: string,
  emailPassword?: string,
  emailType?: string,
  globalCc?: string,
}

export interface RefreshTokenPayload extends TokenPayload { }

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

import { Secret, SignOptions } from "jsonwebtoken";

declare module "jsonwebtoken" {
  export interface JwtPayload {
    id: string;
    role?: string;
  }
}

export interface InternalTokenPayload {
  service: string;
  timestamp: number;
}

export interface TokenConfig {
  secret: Secret;
  expiresIn?: string | number;
}
