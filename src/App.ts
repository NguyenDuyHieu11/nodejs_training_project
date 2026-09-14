import http, { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path';
import { Buffer } from 'node:buffer'

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

export type Handler = (req: IncomingMessage, res: ServerResponse) => void;

interface Route {
    method: HttpMethod;
    segments: string[];
    handler: Handler;
}

function splitPath(path:string): string[] {
    const paths: string[] = path.split("/").filter(Boolean)
    return paths
}

export class App {
    private routes: Route[] = [];
    private server = http.createServer(this.handleRequest.bind(this)) // CONFUSING

    private _register(method: HttpMethod, path: string, handler: Handler) {
        let segments: string[] = splitPath(path)
        this.routes.push({method, segments: segments, handler})
    }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const match = this._match(req.method ?? 'GET', url.pathname);

    if (!match) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    req.params = match.params;
    req.query = Object.fromEntries(url.searchParams);
    match.handler(req, res);
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

