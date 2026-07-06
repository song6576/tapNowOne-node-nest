type WorkflowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowProject = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
};

function thumbSvg(label: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},55%,28%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360},60%,18%)"/></linearGradient></defs><rect width="240" height="160" fill="url(#g)"/><text x="120" y="84" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="13" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildTapTVWorkflow(
  itemId: string,
  title: string,
  nodeCount = 12,
): WorkflowProject {
  const labels = ['Image', '图片生成', '重绘', '后期处理'];
  const density = nodeCount >= 15 ? 'large' : 'medium';
  const cols = density === 'large' ? 9 : 6;
  const rows = density === 'large' ? 5 : 4;
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const now = new Date().toISOString();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${itemId}-n-${r}-${c}`;
      const label = labels[(r + c) % labels.length];
      nodes.push({
        id,
        type: 'image',
        position: { x: c * 210 + r * 36, y: r * 170 + (c % 2) * 24 },
        data: {
          label,
          prompt: `${title} · shot ${r + 1}-${c + 1}`,
          status: 'done',
          outputUrl: thumbSvg(label, (r * 47 + c * 19 + itemId.length * 5) % 360),
        },
      });
      if (c > 0) {
        edges.push({
          id: `${id}-h`,
          source: `${itemId}-n-${r}-${c - 1}`,
          target: id,
        });
      }
      if (r > 0 && c % 3 !== 2) {
        edges.push({
          id: `${id}-v`,
          source: `${itemId}-n-${r - 1}-${c}`,
          target: id,
        });
      }
    }
  }

  return {
    id: `workflow-${itemId}`,
    name: title,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    viewport: { x: 40, y: 20, zoom: density === 'large' ? 0.32 : 0.42 },
  };
}

export function parseWorkflowData(raw: string | null | undefined): WorkflowProject | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkflowProject;
  } catch {
    return null;
  }
}
