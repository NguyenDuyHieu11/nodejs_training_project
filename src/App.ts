import http, { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path';
import { Buffer } from 'node:buffer'
import { Server } from 'node:http';
import { defaultErrorHandler, isPromiseLike } from './error/error.js';
import type { Handler, Middleware, ErrorHandler } from './types.js';
import EventEmitter from 'node:events';
import process from 'node:process';
import { Socket } from 'node:net';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

declare module 'node:http' {
    interface IncomingMessage {
        params: Record<string, string>;
        query: Record<string, string>;
    }

    interface ServerResponse {
        status(code: number): this;
        json(body: unknown): void;
        send(body: string | Buffer | object): void;
    }
}

http.ServerResponse.prototype.json = function (body: unknown) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(body))
}

http.ServerResponse.prototype.send = function (body: string | Buffer | object) {
    if (typeof body === 'string') {
        this.setHeader('Content-Type', 'text/plain');
        this.end(body);
    } else if (Buffer.isBuffer(body)) {
        this.setHeader('Content-Type', 'application/octet-stream');
        this.end(body);
    } else  {
        this.json(body)
    }
    
}

http.ServerResponse.prototype.status = function (code: number) {
  this.statusCode = code;
  return this;
};

interface Route {
    method: HttpMethod;
    segments: string[];
    handler: Handler;
}

function splitPath(path:string): string[] {
    const paths: string[] = path.split("/").filter(Boolean)
    return paths
}

export class App extends EventEmitter {     //   SHARED FOR ALL REQUESTS
    private errorHandler: ErrorHandler = defaultErrorHandler;
    private routes: Route[] = [];
    private middlewares: Middleware[] = [];
    private socketList = new Map<Socket, boolean>();
    private server = http.createServer(this.handleRequest.bind(this)) // CONFUSING
    private shuttingDown = true;

    constructor() {
        super();
        // Guarantees at least one 'error' listener always exists, so emit('error', ...)
        // below never hits EventEmitter's special zero-listener case (which throws
        // synchronously and crashes the process) — regardless of whether the app
        // author registers their own listener.
        this.on('error', () => {});
        this.server.on('connection', (socket: Socket) => {
            this.socketList.set(socket, true);
            socket.on('close', () => {
                this.socketList.delete(socket);
            })
        });

        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());    
    }

    use(fn: Middleware): this {
        this.middlewares.push(fn);
        return this;
    }

    onError(fn: ErrorHandler): this {
        this.errorHandler = fn;
        return this;
    }

    private shutdown(): void {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        console.log('chuan bi tat gracfully');

        for (const entry of this.socketList) {
            if(entry[1]) {
                entry[0].destroy();
            }
        }
    }

    private _register(method: HttpMethod, path: string, handler: Handler) {
        let segments: string[] = splitPath(path)
        this.routes.push({method, segments: segments, handler})
    }

    private handleRequest(req: IncomingMessage, res: ServerResponse): void {

        this.emit('handleRequest', res, req); // bat dau handle request

        res.on('finish', () => {
            setImmediate(() => {this.emit('handleRequestFinishEmitter', res, req)})
        })

        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        let index = 0;

        const onError = (err: unknown): void => {
            this.errorHandler(err, req, res);
            this.emit('error', err, req);
        };

        const next = (): void => {
            try {
                const middleware = this.middlewares[index++];
                if (middleware) {
                    const result = middleware(req, res, next);
                    if (isPromiseLike(result)) result.catch(onError);
                    return;
                }

                const match = this._match(req.method ?? 'GET', url.pathname)
                if (!match) {
                    res.statusCode = 404;
                    res.end('Not Found');
                    return;
                }

                req.params = match.params;
                req.query = Object.fromEntries(url.searchParams);

                const result = match.handler(req, res);
                if (isPromiseLike(result)) result.catch(onError);
            } catch (err) {
                onError(err);
            }
        }

        next();
    }

    /**
     * Finds the first registered route matching an incoming method + pathname.
     *
     * Matching is purely positional: the pathname and each route's pattern are
     * split into '/'-separated segments, and segment counts must match exactly
     * (no wildcards or optional segments). A pattern segment starting with ':'
     * captures whatever is in that position on the actual path; every other
     * segment must match literally.
     *
     * @param method - HTTP method of the incoming request (e.g. 'GET').
     * @param pathname - Request path only, no query string (e.g. '/users/5').
     * @returns The matching route's handler plus extracted params, or null if
     *          no registered route matches both method and shape.
     */
    private _match(
        method: string,
        pathname: string
    ): { handler: Handler; params: Record<string, string> } | null {
        const segments = splitPath(pathname);

        for (const route of this.routes) {
        if (route.method !== method) continue;
        if (route.segments.length !== segments.length) continue;

        const params: Record<string, string> = {};
        let matched = true;

        for (let i = 0; i < segments.length; i++) {
            const routeSeg = route.segments[i];
            const actualSeg = segments[i];

            if (routeSeg.startsWith(':')) {
            params[routeSeg.slice(1)] = decodeURIComponent(actualSeg);
            } else if (routeSeg !== actualSeg) {
            matched = false;
            break;
            }
        }

        if (matched) return { handler: route.handler, params };
        }

        return null;
    }

  listen(...args: Parameters<http.Server['listen']>): http.Server {
    return this.server.listen(...args);
  }

  get(path: string, handler: Handler): this {
    this._register('GET', path, handler);
    return this;
  }
  post(path: string, handler: Handler): this {
    this._register('POST', path, handler);
    return this;
  }
  put(path: string, handler: Handler): this {
    this._register('PUT', path, handler);
    return this;
  }
  delete(path: string, handler: Handler): this {
    this._register('DELETE', path, handler);
    return this;
  }

}

