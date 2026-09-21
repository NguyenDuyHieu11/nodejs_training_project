import { ServerResponse } from "http"
import { ErrorHandler } from "../types.js"

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return typeof value === 'object' && value !== null && typeof (value as any).then === 'function';
}

export const defaultErrorHandler: ErrorHandler = (err, req, res: ServerResponse) => {
    console.log(err);
    if (!res.headersSent) {
        res.status(500).json( {'error': 'Internal server error'});
    }
}

