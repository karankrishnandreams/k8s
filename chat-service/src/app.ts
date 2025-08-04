import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import morgan from "morgan";
import routes from "./routes";
import errorHandler from "./middlewares/errorHandler";
import { connectToDatabase } from "./config/database";
import logger from "./utils/logger";
import configureSocket from "@services/socket.service";

const app = express();
const httpServer = createServer(app);

// ======= Configurations =======
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by");

// Logging
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

// ======= Socket.IO Initialization =======
const io = new Server(httpServer, {
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure Socket.IO events and middleware
configureSocket(io);

// ======= Routes =======
app.use("/", routes);

// ======= Error Handler =======
app.use(errorHandler);

// ======= Export =======
export { httpServer as app, connectToDatabase, io };
