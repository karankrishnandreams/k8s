import { Document, Types } from 'mongoose';



export interface IEvent {
    title: string;               
    description?: string;   
    eventDate: string;
    startTime: string;            
    endTime: string;              
    colorTag?: string;           
    location?: string;           
    status: 'Active' | 'Inactive';  
    companyId: Types.ObjectId;
    userId: Types.ObjectId;
    assignee?: Types.ObjectId;
    createdAt?: Date;           
    updatedAt?: Date;           
    deletedAt?: Date; 
  }
  