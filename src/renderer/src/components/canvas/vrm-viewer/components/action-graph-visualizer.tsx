import React, { useState } from 'react';
import { ACTION_GRAPH, generateMermaidGraph } from '../action-graph';
import { toaster } from '@/components/ui/toaster';

export const ActionGraphVisualizer: React.FC = () => {
  const [showGraph, setShowGraph] = useState(false);
  const mermaidSyntax = generateMermaidGraph();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mermaidSyntax).then(() => {
      toaster.create({
        title: 'Graph copied',
        description: 'Mermaid.js syntax copied to clipboard.',
        type: 'success',
      });
    });
  };

  return (
    <div className="p-4 bg-black/40 rounded-lg border border-white/20 backdrop-blur-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Action Dependency Graph</h3>
        <button
          onClick={() => setShowGraph(!showGraph)}
          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          {showGraph ? 'Hide Syntax' : 'Show Syntax'}
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {Object.values(ACTION_GRAPH).map((node) => (
          <div key={node.id} className="text-xs p-2 bg-white/5 rounded border border-white/10">
            <div className="flex justify-between">
              <span className="font-bold text-blue-300">{node.id}</span>
              <span className="text-gray-400">Layer: {node.layer}</span>
            </div>
            {node.parallelWith && node.parallelWith.length > 0 && (
              <div className="mt-1 text-gray-300">
                <span className="text-gray-500">Parallel with:</span> {node.parallelWith.join(', ')}
              </div>
            )}
            {node.autoTrigger && (
              <div className="mt-1 text-gray-300">
                <span className="text-gray-500">Auto-triggers:</span> {node.autoTrigger}
              </div>
            )}
            {node.disablesIdleProcedural && (
              <div className="mt-1 text-red-400 italic">
                Suppresses procedural motion
              </div>
            )}
          </div>
        ))}
      </div>

      {showGraph && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-400 uppercase">Mermaid.js Syntax</span>
            <button
              onClick={copyToClipboard}
              className="text-[10px] text-blue-400 hover:text-blue-300 underline"
            >
              Copy for Mermaid Live
            </button>
          </div>
          <pre className="text-[10px] p-2 bg-black/60 rounded overflow-x-auto text-green-400 border border-white/10">
            {mermaidSyntax}
          </pre>
        </div>
      )}
    </div>
  );
};
