import Twilio from 'twilio';
import * as dotenv from 'dotenv';
import path from 'path';
import axios from "axios";
import { Request, Response, NextFunction } from "express";

dotenv.config({ path: path.join(__dirname, '../../../.env') });
const API_KEY = process.env.EXCHANGE_RATE_API_KEY; // Your API key
// const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest`;
const BASE_URL = process.env.CURRENCY_BASE_URL;


const sendSms = async (Otpnumber: any) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = Twilio(accountSid, authToken);
    const serviceSid: any = process.env.TWILIO_SERVICE_ID;

    try {
        const verification = await client.verify.v2
            .services(serviceSid)
            .verifications.create({ to: Otpnumber, channel: 'sms' });

        return verification;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

const verifySms = async (number: any, code: any) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = Twilio(accountSid, authToken);
    const serviceSid: any = process.env.TWILIO_SERVICE_ID;
    try {
        const verification_check = client.verify.v2
            .services(serviceSid)
            .verificationChecks.create({ to: number, code })
        return verification_check;

    } catch (error: any) {
        throw new Error(error.message);
    }
};

// const BASE_URL = "https://open.er-api.com/v6/latest";

const convertCurrencyController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { from, to, amount } = req.body;

        if (!from || !to || !amount) {
            res.status(400).json({ error: "Missing from, to or amount parameters" });
            return;
        }

        // Get latest exchange rates for the "from" currency
        const response = await axios.get(`${BASE_URL}/${from}`);

        if (response.status !== 200 || response.data.result !== "success") {
            throw new Error("Failed to fetch exchange rates");
        }

        const rate = response.data.rates[to];
        if (!rate) {
            res.status(400).json({ error: `Unsupported currency: ${to}` });
            return;
        }

        const convertedAmount = Number(amount) * rate;

        res.status(200).json({
            from,
            to,
            amount,
            convertedAmount,
            rate,
        });
    } catch (err: any) {
        console.error("Currency conversion error:", err.message);
        next(err);
    }
};


export { sendSms, verifySms, convertCurrencyController };
