import React from 'react';

interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  shd: number;
  fdr: number;
  pearson: number;
  hamming: number;
  frobenius: number;
}

interface MetricsPanelProps {
  metrics: Metrics;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  const items = [
    { label: 'Precision',  value: metrics.precision,  description: 'Correctness of predicted links' },
    { label: 'Recall',     value: metrics.recall,     description: 'Percentage of expert links found' },
    { label: 'F1 Score',   value: metrics.f1,         description: 'Harmonic mean of precision / recall' },
    { label: 'Pearson',    value: metrics.pearson,    description: 'Adjacency matrix correlation with ground truth' },
    { label: 'SHD',        value: metrics.shd,        description: 'Structural Hamming Distance', reverse: true },
    { label: 'FDR',        value: metrics.fdr,        description: 'False Discovery Rate',        reverse: true },
    { label: 'Hamming',    value: metrics.hamming,    description: 'Normalised bit-flip distance', reverse: true },
    { label: 'Frobenius',  value: metrics.frobenius,  description: 'Matrix norm of adjacency diff', reverse: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`glass-morphism p-4 rounded-xl border-l-2 hover:bg-white/5 transition-all group ${
            item.reverse ? 'border-amber-500/60' : 'border-cyber-accent'
          }`}
        >
          <div className={`text-[10px] uppercase tracking-tighter group-hover:text-cyber-accent transition-colors ${
            item.reverse ? 'text-amber-500/70' : 'text-gray-400'
          }`}>
            {item.label}
          </div>
          <div className={`text-2xl font-bold font-mono ${item.reverse ? 'text-amber-400' : 'gradient-text'}`}>
            {item.value}
          </div>
          <div className="text-[8px] text-gray-500 mt-1 leading-tight flex items-center gap-1">
            {item.reverse && <span className="text-amber-600">↓</span>}
            {item.description}{item.reverse ? ' — lower is better' : ''}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricsPanel;
