import { Document } from 'mongoose';

export interface IEmailTemplate extends Document {
  specialization: string; // Renamed field
  slug: string;
  htmlBody: string;
  isActive: boolean;
  deletedAt?: Date | null;
  softDelete(): Promise<void>;
}
