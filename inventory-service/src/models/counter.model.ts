// models/Counter.ts
import mongoose, { Schema, Document } from "mongoose";

interface ICounter extends Document {
  type: string;
  seq: number;
  digits?: number; 
}

const CounterSchema = new Schema<ICounter>({
  type: { type: String, required: true, unique: true }, // "client" or "vendor"
  seq: { type: Number, default: 0 },
  digits: { type: Number, default: 0 } 
});

// export default mongoose.model<ICounter>("Counter", CounterSchema);
export default CounterSchema