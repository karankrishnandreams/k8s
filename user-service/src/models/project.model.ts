import { Schema } from "mongoose";

const ProjectSchema = new Schema(
  {
    projectNumber: { type: String, required: true, unique: true },
    entity:        { type: String, required: true },
    branch:        { type: String, required: true },
    product:       { type: String, required: true },
    user:          { type: String, required: true },
    createdDate:   { type: Date,   required: true },
    agent:         { type: String, required: true },
    itemDescription:{type:String},
    attachedFile: { type: String, default: null },
    status:        {
      type:String,
      enum:[
        "Project-Created","Shipped","Received","Receiving-log send",
        "Auditing","Completed","On-hold","Cancelled"
      ],
      default:"Project-Created"
    }
  },
  { timestamps:true }
);

export default ProjectSchema;
