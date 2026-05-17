import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';

interface CausalGraphProps {
  nodes: string[];
  edges: { source: string; target: string }[];
  title: string;
  /** Pass ground truth to the prediction graph → colors edges green (TP) or red (FP) */
  groundTruthEdges?: { source: string; target: string }[];
  /** Pass predicted edges to the GT graph → colors found edges green, missed edges grey dashed */
  predictedEdges?: { source: string; target: string }[];
}

const COLORS = {
  default: '#00f2ff',
  tp:      '#4ade80',
  fp:      '#f87171',
  missed:  '#374151',
};

const CausalGraph: React.FC<CausalGraphProps> = ({
  nodes,
  edges,
  title,
  groundTruthEdges,
  predictedEdges,
}) => {
  const gtSet   = useMemo(() => new Set((groundTruthEdges ?? []).map(e => `${e.source}|${e.target}`)), [groundTruthEdges]);
  const predSet = useMemo(() => new Set((predictedEdges  ?? []).map(e => `${e.source}|${e.target}`)), [predictedEdges]);

  const flowNodes: Node[] = useMemo(() => nodes.map((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const radius = 250;
    return {
      id: node,
      data: { label: node.replace(/_/g, ' ') },
      position: { x: 400 + radius * Math.cos(angle), y: 300 + radius * Math.sin(angle) },
      style: {
        background: 'rgba(0, 242, 255, 0.07)',
        color: '#fff',
        border: '2px solid #00f2ff',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        width: 140,
        padding: '10px',
        textAlign: 'center' as const,
        backdropFilter: 'blur(8px)',
        textTransform: 'uppercase' as const,
        boxShadow: '0 0 20px rgba(0, 242, 255, 0.15)',
      },
    };
  }), [nodes]);

  const flowEdges: Edge[] = useMemo(() => {
    return edges
      .filter(e => nodes.includes(e.source) && nodes.includes(e.target))
      .map((e, i) => {
        const key = `${e.source}|${e.target}`;

        // prediction graph: color by TP/FP
        let color = COLORS.default;
        let animated = true;
        let strokeDasharray: string | undefined;

        if (groundTruthEdges !== undefined) {
          color = gtSet.has(key) ? COLORS.tp : COLORS.fp;
        } else if (predictedEdges !== undefined) {
          // GT graph: found vs missed
          if (predSet.has(key)) {
            color = COLORS.tp;
          } else {
            color = COLORS.missed;
            animated = false;
            strokeDasharray = '6 4';
          }
        }

        return {
          id: `e-${e.source}-${e.target}-${i}`,
          source: e.source,
          target: e.target,
          type: ConnectionLineType.SmoothStep,
          animated,
          style: { stroke: color, strokeWidth: animated ? 3 : 2, opacity: 0.85, strokeDasharray },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 18,
            height: 18,
          },
        };
      });
  }, [edges, nodes, gtSet, predSet, groundTruthEdges, predictedEdges]);

  // Legend shown when coloring is active
  const showLegend = groundTruthEdges !== undefined || predictedEdges !== undefined;

  return (
    <div className="w-full h-[500px] glass-morphism rounded-[2rem] relative overflow-hidden border border-white/5 shadow-2xl">
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <div className="w-2 h-2 bg-cyber-accent rounded-full animate-pulse" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{title}</h3>
      </div>

      {showLegend && (
        <div className="absolute top-6 right-6 z-10 flex flex-col gap-1.5 bg-black/60 rounded-xl px-4 py-3 border border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-full" style={{ background: COLORS.tp }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
              {groundTruthEdges !== undefined ? 'Correct' : 'Found'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 rounded-full" style={{ background: groundTruthEdges !== undefined ? COLORS.fp : COLORS.missed, opacity: 0.7 }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
              {groundTruthEdges !== undefined ? 'False Positive' : 'Missed'}
            </span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        nodesDraggable
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag
      >
        <Background color="#111" gap={24} size={1} />
        <Controls showInteractive={false} className="bg-black/50 border-white/10" />
      </ReactFlow>
    </div>
  );
};

export default CausalGraph;
