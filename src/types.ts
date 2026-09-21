import { promises } from "node:dns";
import { ServerResponse } from "node:http";
import { IncomingMessage } from "node:http";

export type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export type ErrorHandler = (error: unknown, req: IncomingMessage, res: ServerResponse) => void;

export type Middleware = (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
) => void | Promise<void>;