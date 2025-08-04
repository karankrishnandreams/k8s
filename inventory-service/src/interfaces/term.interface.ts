export interface ITerm {
  name: string;
  description: string;
  days: number;
}
export interface ITermDocument extends ITerm, Document {
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}