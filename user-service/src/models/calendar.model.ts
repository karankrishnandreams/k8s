import { IEvent } from "@interfaces/calendar.interface";
import moment from "moment";
import { Schema } from "mongoose";

// Location Schema Definition
const EventSchema: Schema<IEvent> = new Schema<IEvent>(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
        },
        eventDate: {
            type: String,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
        colorTag: {
            type: String,
            required: false,
        },
        location: {
            type: String,
            required: false,
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            required: true
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true
        },
        userId: {
            type: Schema.Types.ObjectId,    
            ref: 'User',
            required: true
        },
        assignee:{
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        deletedAt: {
            type: Date,
            default: null
        },
        createdAt: {
            type: Date,
            default: () => moment().toDate()
        },
        updatedAt: {
            type: Date,
            default: () => moment().toDate()
        }
    },

);

   // Automatically update updatedAt before saving
   EventSchema.pre("save", function (next) {
    this.updatedAt = moment().toDate();
    next();
  });
  
  // Soft delete method
  EventSchema.methods.softDelete = async function () {
    this.deletedAt = moment().toDate();
    await this.save();
  };
  

export default EventSchema;