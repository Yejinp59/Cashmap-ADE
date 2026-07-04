import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface RawNode {
  id: string;
  name: string;
  type: 'main' | 'supplier' | 'risk' | 'neutral';
  score?: number;
}

interface Node extends RawNode {
  x: number;
  y: number;
}

interface Link {
  source: string;
  target: string;
  strength: number;
}

const DEFAULT_NODES: RawNode[] = [
  { id: 'main', name: '현대자동차', type: 'main' as const, score: 95 },
  { id: 's1', name: 'LG에너지', type: 'supplier' as const, score: 92 },
  { id: 's2', name: 'SK이노베이션', type: 'supplier' as const, score: 88 },
  { id: 's3', name: '삼성SDI', type: 'supplier' as const, score: 90 },
  { id: 's4', name: 'LG화학', type: 'supplier' as const, score: 85 },
  { id: 's5', name: 'SK케미칼', type: 'supplier' as const, score: 80 },
  { id: 's6', name: '아이리스', type: 'supplier' as const, score: 78 },
  { id: 'r1', name: '공급망 중단', type: 'risk' as const, score: 45 },
  { id: 'r2', name: '수급난', type: 'risk' as const, score: 50 },
  { id: 'n1', name: '협력사A', type: 'neutral' as const, score: 70 },
  { id: 'n2', name: '협력사B', type: 'neutral' as const, score: 72 },
  { id: 'n3', name: '협력사C', type: 'neutral' as const, score: 68 },
  { id: 'n4', name: '협력사D', type: 'neutral' as const, score: 65 },
  { id: 'n5', name: '협력사E', type: 'neutral' as const, score: 60 },
  { id: 's7', name: '포스코케미칼', type: 'supplier' as const, score: 82 },
  { id: 's8', name: '에코프로', type: 'supplier' as const, score: 79 },
  { id: 'r3', name: '원자재 급등', type: 'risk' as const, score: 55 },
];

const DEFAULT_LINKS: Link[] = [
  { source: 'main', target: 's1', strength: 0.9 },
  { source: 'main', target: 's2', strength: 0.85 },
  { source: 'main', target: 's3', strength: 0.88 },
  { source: 'main', target: 's4', strength: 0.75 },
  { source: 'main', target: 's5', strength: 0.65 },
  { source: 'main', target: 's6', strength: 0.6 },
  { source: 'main', target: 's7', strength: 0.7 },
  { source: 'main', target: 's8', strength: 0.68 },
  { source: 'main', target: 'r1', strength: 0.5 },
  { source: 'main', target: 'r2', strength: 0.45 },
  { source: 'main', target: 'r3', strength: 0.4 },
  { source: 's1', target: 'n1', strength: 0.6 },
  { source: 's1', target: 'n4', strength: 0.5 },
  { source: 's2', target: 'n2', strength: 0.55 },
  { source: 's3', target: 'n3', strength: 0.58 },
  { source: 's4', target: 'n5', strength: 0.5 },
  { source: 's1', target: 's2', strength: 0.3 },
  { source: 's3', target: 's4', strength: 0.25 },
  { source: 's7', target: 's8', strength: 0.35 },
  { source: 'r1', target: 'r2', strength: 0.4 },
];

const getNodeColor = (type: string, isHovered: boolean): string => {
  if (isHovered) return '#fbbf24';
  switch (type) {
    case 'main': return '#ffffff';
    case 'supplier': return '#ef4444';
    case 'risk': return '#f97316';
    case 'neutral': return '#9ca3af';
    default: return '#6b7280';
  }
};

const getNodeSize = (type: string): number => {
  switch (type) {
    case 'main': return 35;
    case 'supplier': return 12;
    case 'risk': return 10;
    case 'neutral': return 8;
    default: return 8;
  }
};

const WIDTH = 1000;
const HEIGHT = 700;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

interface NetworkViewProps {
  rawNodes?: RawNode[];
  rawLinks?: Link[];
}

export default function NetworkView({
  rawNodes = DEFAULT_NODES,
  rawLinks = DEFAULT_LINKS,
}: NetworkViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Fixed radial layout - no simulation
  const initializeNodes = useCallback(() => {
    if (rawNodes.length === 0) { setNodes([]); return; }
    const positioned: Node[] = [];

    // Center node
    positioned.push({
      ...rawNodes[0],
      x: CENTER_X,
      y: CENTER_Y,
    });

    // Other nodes in radial layout
    const otherNodes = rawNodes.slice(1);
    const radius = 220;

    otherNodes.forEach((node, idx) => {
      const angle = (idx / otherNodes.length) * Math.PI * 2 - Math.PI / 2;
      positioned.push({
        ...node,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    });

    setNodes(positioned);
  }, [rawNodes]);

  useEffect(() => {
    initializeNodes();
  }, [initializeNodes]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const z = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;

    ctx.save();

    // Clear with dark background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Apply zoom + pan transform
    ctx.translate(px + WIDTH / 2, py + HEIGHT / 2);
    ctx.scale(z, z);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WIDTH, i);
      ctx.stroke();
    }

    // Draw radial gradient from center
    const gradient = ctx.createRadialGradient(CENTER_X, CENTER_Y, 0, CENTER_X, CENTER_Y, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.07)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw links
    rawLinks.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      if (!source || !target) return;

      const isHighlighted = hoveredNode === source.id || hoveredNode === target.id;
      const opacity = isHighlighted ? 0.9 : 0.5 + link.strength * 0.3;
      const lineWidth = isHighlighted ? 2.5 : 1 + link.strength * 1.2;

      ctx.strokeStyle = isHighlighted
        ? `rgba(96, 165, 250, ${opacity})`
        : `rgba(148, 163, 184, ${opacity})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      const isHovered = hoveredNode === node.id;
      const size = getNodeSize(node.type);
      const color = getNodeColor(node.type, isHovered);

      // Glow effect
      if (isHovered || node.type === 'main') {
        const glowGradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, size * 3
        );
        glowGradient.addColorStop(0, `${color}40`);
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Border for hovered
      if (isHovered) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `${node.type === 'main' ? 'bold 13px' : '11px'} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, node.x, node.y + size + 6);

      // D-Score badge (not for main; only when score 있음)
      if (node.type !== 'main' && node.score != null) {
        const badgeW = 38;
        const badgeH = 18;
        const badgeX = node.x - badgeW / 2;
        const badgeY = node.y - size - 22;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`D:${node.score}`, node.x, badgeY + badgeH / 2);
      }
    });

    ctx.restore();
  }, [nodes, hoveredNode, zoom, pan, rawLinks]);

  // Convert screen pos to canvas world pos
  const getWorldPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    const z = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
    return {
      x: (screenX - px - WIDTH / 2) / z + WIDTH / 2,
      y: (screenY - py - HEIGHT / 2) / z + HEIGHT / 2,
    };
  };

  const findNodeAt = (x: number, y: number) => {
    for (const node of [...nodes].reverse()) {
      const size = getNodeSize(node.type);
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist <= size + 15) return node;
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getWorldPos(e);
    const node = findNodeAt(pos.x, pos.y);
    setHoveredNode(node?.id || null);

    if (draggedNode) {
      // Only update the dragged node position
      setNodes(prev => prev.map(n => 
        n.id === draggedNode && n.id !== 'main'
          ? { ...n, x: pos.x, y: pos.y }
          : n
      ));
    } else if (isPanningRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      const dx = (e.clientX - panStartRef.current.x) * scaleX;
      const dy = (e.clientY - panStartRef.current.y) * scaleY;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      setPan({ ...panRef.current });
    }

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = node ? 'pointer' : isPanningRef.current ? 'grabbing' : 'grab';
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getWorldPos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node && node.id !== 'main') {
      setDraggedNode(node.id);
    } else {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    isPanningRef.current = false;
  };

  // React onWheel은 Chrome에서 passive:true가 기본이라 preventDefault가 무시됨.
  // → useEffect로 native listener를 passive:false로 등록해 페이지 스크롤/줌 방지.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoomRef.current * delta, 0.3), 4);
      zoomRef.current = newZoom;
      setZoom(newZoom);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomRef.current * 1.2, 4);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomRef.current / 1.2, 0.3);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  };

  const handleReset = () => {
    zoomRef.current = 1;
    setZoom(1);
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    initializeNodes();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-border">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="기업명 검색..."
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <button
          onClick={handleReset}
          className="p-2 hover:bg-secondary rounded transition text-muted-foreground hover:text-foreground"
          title="초기화"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-slate-700 overflow-hidden shadow-2xl mx-auto"
        style={{ width: "fit-content", maxWidth: "100%" }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="block mx-auto max-w-full"
          style={{
            aspectRatio: `${WIDTH}/${HEIGHT}`,
            width: "auto",
            height: "auto",
            // topbar(56) + page padding(40) + controls(60) + gap(16) + 여유(28) ≈ 200px
            maxHeight: "calc(100vh - 200px)",
          }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-slate-700 text-[11px]">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-4 h-4 rounded-full bg-white shadow-lg shadow-white/20" />
            <span>핵심기업</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>주요협력사</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>위험신호</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span>모니터링</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 text-lg font-light transition-colors"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 text-lg font-light transition-colors"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-8 h-6 flex items-center justify-center bg-slate-900/80 border border-slate-700 rounded text-[10px] text-slate-400">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Info */}
        <div className="absolute top-4 left-4 text-xs text-slate-400 pointer-events-none bg-slate-900/70 px-2 py-1 rounded">
          휠: 확대/축소 | 배경 드래그: 이동 | 노드 드래그: 위치 조정
        </div>
      </div>
    </div>
  );
}
