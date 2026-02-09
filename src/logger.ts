import pino from "pino";
import { config } from "./config.js";

export const logger = config.isDev
  ? pino({ level: config.logLevel, transport: { target: "pino-pretty" } })
  : pino({ level: config.logLevel });
