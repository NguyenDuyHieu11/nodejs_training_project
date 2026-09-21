import { Worker } from 'node:worker_threads'
import os from 'node:os'

interface PendingJob {
 resolve: (input: unknown, ) => void;
}


export class WorkerPool {
    private idle: Worker[] = [];
    private active = new Map<Worker, PendingJob>();
    private jobQueue: (PendingJob & {taskName: string, payload: unknown})[] = []

    constructor(size: number = os.availableParallelism()) {
        for (let i: number = 0; i < size; i++) {
            this.idle.push(this.spawnWorker());
        }
    }

    private dispatchNext(): void {

    }

    private spawnWorker(): Worker {
        const worker = new Worker(new URL('./workerthread/worker.ts', import.meta.url), {
            execArgv: ['--import', 'tsx'],
        })

        worker.on('message', (value) => {
            const job = this.active.get(worker)
            this.active.delete(worker);
            job?.resolve(value); // job se chi done khi ma minh resolve no
            this.idle.push(worker);
            this.dispatchNext();
        })

        return worker;
    }

  run<T>(taskName: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => {
      this.jobQueue.push({ resolve: resolve as (value: unknown) => void, taskName, payload });
      this.dispatchNext();
    });
  }
}