import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TaskState = 'pending' | 'running' | 'completed' | 'failed';
export type TaskKind = 'generate' | 'compose';

export type GenerateTask = {
  task_id: string;
  user_id: number;
  kind: TaskKind;
  state: TaskState;
  progress: number;
  result_url?: string;
  error?: string;
  node_type?: 'image' | 'video' | 'audio';
  provider?: string;
  provider_task_id?: string;
  metadata?: string;
  created_at: number;
  updated_at: number;
};

/** Prisma 持久化任务表：支持 Seedance/FFmpeg 长任务与进程重启后的状态查询 */
@Injectable()
export class TaskStore {
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async create(opts: {
    userId: number;
    kind: TaskKind;
    nodeType?: GenerateTask['node_type'];
    metadata?: string;
  }): Promise<GenerateTask> {
    await this.gc();
    const row = await this.prisma.generationTask.create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        nodeType: opts.nodeType,
        metadata: opts.metadata,
        expiresAt: new Date(Date.now() + this.TTL_MS),
      },
    });
    return this.toTask(row);
  }

  async get(taskId: string, userId: number): Promise<GenerateTask | undefined> {
    await this.gc();
    const row = await this.prisma.generationTask.findFirst({
      where: { id: taskId, userId },
    });
    return row ? this.toTask(row) : undefined;
  }

  async listRecoverable(kind?: TaskKind): Promise<GenerateTask[]> {
    const rows = await this.prisma.generationTask.findMany({
      where: {
        ...(kind ? { kind } : {}),
        state: { in: ['pending', 'running'] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toTask(row));
  }

  async update(
    taskId: string,
    patch: Partial<
      Pick<
        GenerateTask,
        | 'state'
        | 'progress'
        | 'result_url'
        | 'error'
        | 'provider'
        | 'provider_task_id'
        | 'metadata'
      >
    >,
  ): Promise<GenerateTask | undefined> {
    try {
      const row = await this.prisma.generationTask.update({
        where: { id: taskId },
        data: {
          state: patch.state,
          progress: patch.progress,
          resultUrl: patch.result_url,
          error: patch.error,
          provider: patch.provider,
          providerTaskId: patch.provider_task_id,
          metadata: patch.metadata,
        },
      });
      return this.toTask(row);
    } catch {
      return undefined;
    }
  }

  private async gc() {
    await this.prisma.generationTask.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  private toTask(row: {
    id: string;
    userId: number;
    kind: string;
    nodeType: string | null;
    provider: string | null;
    providerTaskId: string | null;
    state: string;
    progress: number;
    resultUrl: string | null;
    error: string | null;
    metadata: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GenerateTask {
    return {
      task_id: row.id,
      user_id: row.userId,
      kind: row.kind as TaskKind,
      state: row.state as TaskState,
      progress: row.progress,
      result_url: row.resultUrl ?? undefined,
      error: row.error ?? undefined,
      node_type: (row.nodeType as GenerateTask['node_type']) ?? undefined,
      provider: row.provider ?? undefined,
      provider_task_id: row.providerTaskId ?? undefined,
      metadata: row.metadata ?? undefined,
      created_at: row.createdAt.getTime(),
      updated_at: row.updatedAt.getTime(),
    };
  }
}
