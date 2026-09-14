import http, { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

export interface Request extends IncomingMessage {
    params: Record<string, string>;
}

export type Handler = (req: Request, res: ServerResponse) => void;

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
        const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`); // ?? return ve trai neu ve phai is either null or undefined
        const match = this._match(req.method ?? 'GET', pathname)

        if (!match) {
            res.statusCode = 400;
            res.end('Not Found');
            return;
        }
        
        (req as Request).params = match.params;
        match.handler(req as Request, res);
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

