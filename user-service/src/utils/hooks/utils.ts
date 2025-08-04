import { Request, Response, NextFunction } from "express";

export const ApiResponse = async (
  res: any,
  response: {
    status: number;
    message: string;
    validation?: any;
    totalCount?: any;
    data?: any;
  }
) => {
  return res.status(response.status).json(response);
};

export const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return user[0] + "***@" + domain;
};
