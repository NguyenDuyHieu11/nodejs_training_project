import { IncomingHttpHeaders, IncomingMessage } from "http";
import type { Middleware } from "./App.js";

declare module 'node:http' {
    interface IncomingMessage {
        body: unknown
    }
}
// return a function object
export function json(): Middleware {
    return (req, res, next) => { // (??) TS can not enforce shit here since it just return a function object (??)
        const contentType = req.headers['content-type'] ?? '';
        if (!contentType.includes('application/json')) {
            next();
            return;
        }

        // I can't know how many bytes will come in advance so
        // I can't just Buffer.alloc(). Maybe using array is enough?
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => {chunks.push(chunk)})
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            req.body = raw.length > 0 ? JSON.parse(raw) : {};
            next();
        });
    }
}

export function urlencoded(): Middleware {
    return (req, res, next) => {
        const contentType = req.headers['content-type'] ?? '';
        if (!contentType.includes('application/x-www-form-urlencoded')) {
            next();
            return;
        }

        const chunks: Buffer[] = [];

        req.on('data', (chunk: Buffer) => {chunks.push(chunk)});
        req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        req.body = Object.fromEntries(new URLSearchParams(raw));
        next();

        });
    }                                               
}