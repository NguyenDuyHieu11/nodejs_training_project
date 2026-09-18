import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';

interface Task {
  taskName: string;
  payload: unknown;
}

function wordFrequency(payload: { filePath: string }): Record<string, number> {
  const text = readFileSync(payload.filePath, 'utf8');
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];

  const counts: Record<string, number> = {};
  for (const word of words) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}

const tasks: Record<string, (payload: any) => unknown> = {
  wordFrequency,
};

parentPort?.on('message', (task: Task) => {
  const result = tasks[task.taskName](task.payload);
  parentPort?.postMessage(result);
});
