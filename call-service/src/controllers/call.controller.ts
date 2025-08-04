import { Request, Response, NextFunction } from "express";
import { jwt, twiml as TwiML } from "twilio";
import dotenv from "dotenv";
import createHttpError from "http-errors";

dotenv.config();

const AccessToken = jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * Generates a valid Twilio access token with VoiceGrant.
 */
export const generateTwilioToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.id) {
      throw new Error("Missing user identity for Twilio token.");
    }

    const identity = `user_2`;

    // Create a new VoiceGrant with outgoingApplicationSid
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWIML_APP_SID,
      incomingAllow: true,
    });

    // Construct the access token
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      {
        identity,
        // ttl: 3600,
      }
    );

    token.addGrant(voiceGrant); // Must be added before generating JWT
    const jwtToken = token.toJwt(); // Generate the final token string

    console.log('jwtToken 0000', jwtToken);

    res.status(200).json({
      token: jwtToken,
      identity,
    });
  } catch (error: any) {
    console.error("Token generation error:", error.message || error);
    next(createHttpError(500, "Failed to generate Twilio token"));
  }
};

/**
 * Handles TwiML XML response when Twilio makes a webhook call to connect the phone number.
 */
export const handleVoiceTwiML = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const to = (req.body?.to || req.query?.to || "").trim();
    console.log('to -----', to);

    if (!to) {
      res
        .status(400)
        .type("text/xml")
        .send('<Response><Say>Missing destination number</Say></Response>');
      return;
    }

    const response = new TwiML.VoiceResponse();

    console.log('response -----', response);
    const dial = response.dial({
      callerId: process.env.TWILIO_NUMBER, // Must be a Twilio verified number
    });
    console.log('dial -----', dial);

    dial.number(to);

    console.log('success -----');
    res.type("text/xml").send(response.toString());
  } catch (error: any) {
    console.log("Voice TwiML generation failed:", error.message || error);
    next(createHttpError(500, "Failed to generate TwiML"));
  }
};

// export const handleVoiceTwiML = (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const to = (req.body?.to || req.query?.to || "").trim();
//     console.log("Twilio call request to:", to);

//     const response = new TwiML.VoiceResponse();

//     if (!to) {
//       // Phone to app call (incoming call on Twilio number)
//       const dial = response.dial({ callerId: process.env.TWILIO_NUMBER });
//       console.log('dial successfully if');
//       dial.client("user_2");  // your app client identity
//     } else if (/^\+?\d{8,15}$/.test(to)) {
//       // App to phone call
//       const dial = response.dial({ callerId: process.env.TWILIO_NUMBER });
//       console.log('dial successfully else if');
//       dial.number(to);
//     } else {
//       // App to app call
//       const dial = response.dial({ callerId: process.env.TWILIO_NUMBER });
//       console.log('dial successfully else');
//       dial.client(to);
//     }

//     res.type("text/xml").send(response.toString());
//   } catch (error: any) {
//     console.error("Voice TwiML generation failed:", error.message || error);
//     next(createHttpError(500, "Failed to generate TwiML"));
//   }
// };
