import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type TaskState = 'pending' | 'running' | 'completed' | 'failed';

export type GenerateTask = {
  task_id: string;
  state: TaskState;
  result_url?: string;
  error?: string;
  node_type: 'image' | 'video' | 'audio';
  created_at: number;
  updated_at: number;
};

/** 内存任务表：进程重启后清空；足够本地/单机开发轮询 */
@Injectable()
export class TaskStore {
  private readonly tasks = new Map<string, GenerateTask>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  create(nodeType: GenerateTask['node_type']): GenerateTask {
    this.gc();
    const now = Date.now();
    const task: GenerateTask = {
      task_id: randomUUID(),
      state: 'pending',
      node_type: nodeType,
      created_at: now,
      updated_at: now,
    };
    this.tasks.set(task.task_id, task);
    return task;
  }

  get(taskId: string): GenerateTask | undefined {
    this.gc();
    return this.tasks.get(taskId);
  }

  update(
    taskId: string,
    patch: Partial<Pick<GenerateTask, 'state' | 'result_url' | 'error'>>,
  ): GenerateTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    Object.assign(task, patch, { updated_at: Date.now() });
    return task;
  }

  private gc() {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      if (now - task.created_at > this.TTL_MS) this.tasks.delete(id);
    }
  }
}
