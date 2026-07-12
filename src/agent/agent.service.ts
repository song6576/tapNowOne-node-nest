import { resolveAgentModel } from './agent-models';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessage, DashScopeService } from './dashscope.service';

const AGENT_SYSTEM = `你是 TapFlow 创作助手，帮助用户规划 AI 视频/图片工作流，并操作画布节点。回答简洁实用，中文回复。

当用户要求在画布上创建/添加/新建节点（文本、图片、视频、音频）时：
1. 先用一两句中文说明你要做什么；
2. 在回复末尾附加且仅附加一个 JSON 代码块（不要加其它说明），格式如下：
\`\`\`json
{"actions":[{"type":"add_node","node_type":"image","label":"可选标题","prompt":"可选提示词","count":1}]}
\`\`\`
规则：
- node_type 只能是 text | image | video | audio
- count 可选，默认 1，最多 6
- 可一次返回多个 actions
- 普通闲聊或与建节点无关的问题不要附加此 JSON`;

const STORYBOARD_SYSTEM = `你是专业分镜导演。用户会提供一段脚本或创意描述。
请将其拆分为 3-6 个分镜场景，每个场景包含 label（简短中文标题）和 prompt（用于 AI 文生图的英文或中文描述，50字以内）。
只输出 JSON，格式如下，不要输出其他内容：
{"scenes":[{"label":"场景1","prompt":"..."},{"label":"场景2","prompt":"..."}]}`;

export type StoryboardScene = {
  label: string;
  prompt: string;
};

export type CanvasAction = {
  type: 'add_node';
  node_type: 'text' | 'image' | 'video' | 'audio';
  label?: string;
  prompt?: string;
  count?: number;
};

@Injectable()
export class AgentService {
  constructor(
    private readonly dashscope: DashScopeService,
    private readonly prisma: PrismaService,
  ) {}

  async chat(
    message: string,
    context: string | undefined,
    user: User | null,
    conversationId?: string,
    projectId?: string,
    model?: string,
    auto = true,
  ): Promise<{ reply: string; conversationId?: string; actions?: CanvasAction[] }> {
    const system = context
      ? `${AGENT_SYSTEM}\n\n当前画布状态：\n${context}`
      : AGENT_SYSTEM;

    let history: ChatMessage[] = [];
    let convId = conversationId;

    if (user && projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
      });
      if (!project) {
        throw new NotFoundException('项目不存在');
      }
    }

    if (user && convId) {
      const conversation = await this.prisma.agentConversation.findFirst({
        where: { id: convId, userId: user.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 20 },
        },
      });
      if (!conversation) {
        throw new NotFoundException('对话不存在');
      }
      if (projectId && conversation.projectId && conversation.projectId !== projectId) {
        throw new BadRequestException('对话与项目不匹配');
      }
      history = conversation.messages.map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
      }));
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ];

    const rawReply = await this.dashscope.chatCompletion(
      messages,
      resolveAgentModel(model, auto),
    );
    const { reply, actions } = this.parseCanvasActions(rawReply);

    if (user) {
      if (!convId) {
        const title = message.slice(0, 40).trim() || '新对话';
        const created = await this.prisma.agentConversation.create({
          data: {
            userId: user.id,
            projectId: projectId ?? null,
            title,
          },
        });
        convId = created.id;
      } else if (projectId) {
        await this.prisma.agentConversation.updateMany({
          where: { id: convId, userId: user.id, projectId: null },
          data: { projectId },
        });
      }

      await this.prisma.agentMessage.createMany({
        data: [
          { conversationId: convId, role: 'user', content: message },
          { conversationId: convId, role: 'assistant', content: reply },
        ],
      });

      await this.prisma.agentConversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      });
    }

    return { reply, conversationId: convId, actions };
  }

  async getConversation(userId: number, conversationId: string) {
    const conversation = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('对话不存在');
    }
    return {
      id: conversation.id,
      project_id: conversation.projectId,
      title: conversation.title,
      created_at: conversation.createdAt.toISOString(),
      updated_at: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.createdAt.toISOString(),
      })),
    };
  }

  async storyboard(
    script: string,
    model?: string,
    auto = true,
  ): Promise<StoryboardScene[]> {
    const content = await this.dashscope.chatCompletion(
      [
        { role: 'system', content: STORYBOARD_SYSTEM },
        {
          role: 'user',
          content: `请将以下脚本拆分为分镜：\n\n${script}`,
        },
      ],
      resolveAgentModel(model, auto),
    );
    return this.parseStoryboardJson(content);
  }

  private parseCanvasActions(text: string): {
    reply: string;
    actions: CanvasAction[];
  } {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const rawJson =
      fence?.[1]?.trim() || text.match(/\{[\s\S]*"actions"[\s\S]*\}/)?.[0];
    if (!rawJson) {
      return { reply: text.trim(), actions: [] };
    }

    let data: { actions?: unknown[] };
    try {
      data = JSON.parse(rawJson) as typeof data;
    } catch {
      return { reply: text.trim(), actions: [] };
    }

    const allowed = new Set(['text', 'image', 'video', 'audio']);
    const actions: CanvasAction[] = [];
    for (const item of data.actions ?? []) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (row.type !== 'add_node') continue;
      const nodeType = String(row.node_type ?? '');
      if (!allowed.has(nodeType)) continue;
      const countRaw = Number(row.count ?? 1);
      const count = Number.isFinite(countRaw)
        ? Math.min(6, Math.max(1, Math.floor(countRaw)))
        : 1;
      actions.push({
        type: 'add_node',
        node_type: nodeType as CanvasAction['node_type'],
        label:
          typeof row.label === 'string' ? row.label.trim() || undefined : undefined,
        prompt:
          typeof row.prompt === 'string' ? row.prompt.trim() || undefined : undefined,
        count,
      });
    }

    let reply = text.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();
    if (!reply && actions.length) {
      reply = '已按你的要求准备好画布节点。';
    }
    return { reply, actions };
  }

  private parseStoryboardJson(text: string): StoryboardScene[] {
    const match = text.match(/\{[\s\S]*"scenes"[\s\S]*\}/);
    if (!match) {
      throw new BadRequestException('Agent 未返回有效的分镜 JSON');
    }

    let data: { scenes?: Array<{ label?: string; prompt?: string }> };
    try {
      data = JSON.parse(match[0]) as typeof data;
    } catch {
      throw new BadRequestException('分镜 JSON 解析失败');
    }

    const scenes = data.scenes ?? [];
    if (!scenes.length) {
      throw new BadRequestException('分镜列表为空');
    }

    return scenes.map((scene, index) => ({
      label: scene.label?.trim() || `分镜${index + 1}`,
      prompt: scene.prompt?.trim() || '',
    }));
  }
}
