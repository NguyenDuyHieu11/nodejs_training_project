import fs from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { Middleware } from './types.js'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};


export function serverStatic(rootDir:string): Middleware {
    const root = path.resolve(rootDir);

    return (req, res, next) => {
        if (req.method !== 'GET') {
            next();
            return;
        }

        const pathName = decodeURIComponent(
            new URL(req.url ?? '/', `http://${req.headers.host}`).pathname
        );
        const resolved = path.resolve(root, '.' + pathName);

        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            next();
            return;
        }

        // stat() return a Promise<Stats>, understand as,
        // a Promise that, when resolved, give you a value of type T
        stat(resolved) // 
            .then((stats) => {
                if (!stats.isFile) {
                    next();
                    return;
                }

                res.setHeader('Content-Type', MIME_TYPES[path.extname(resolved)] ?? 'aplication/octet-stream');
                fs.createReadStream(resolved).pipe(res) // stream data tu readable sang writable
            })
            .catch(() => next());
    }
}

