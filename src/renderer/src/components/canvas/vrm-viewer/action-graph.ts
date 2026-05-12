import { AnimationHierarchy } from './types';

export type AnimationLayer = 'base' | 'body' | 'face' | 'gestures';

export interface ActionNode {
  id: string;
  category: keyof AnimationHierarchy | string;
  layer: AnimationLayer;
  disablesIdleProcedural: boolean;
  parallelWith?: string[]; // IDs of actions this can run with
  autoTrigger?: string;    // Action ID to trigger after this one ends
}

export const ACTION_GRAPH: Record<string, ActionNode> = {
  idle: {
    id: 'idle',
    category: 'idle',
    layer: 'base',
    disablesIdleProcedural: false,
    parallelWith: ['talking', 'thinking'],
  },
  thinking: {
    id: 'thinking',
    category: 'thinking',
    layer: 'base',
    disablesIdleProcedural: false,
    parallelWith: ['talking'],
  },
  talking: {
    id: 'talking',
    category: 'talking',
    layer: 'face',
    disablesIdleProcedural: false,
    parallelWith: ['idle', 'thinking', 'dance', 'taunt', 'walking', 'sit'],
  },
  walking: {
    id: 'walking',
    category: 'walking',
    layer: 'base',
    disablesIdleProcedural: true,
    parallelWith: ['talking'],
  },
  sit: {
    id: 'sit',
    category: 'sit',
    layer: 'base',
    disablesIdleProcedural: false,
    parallelWith: ['talking'],
  },
  taunt: {
    id: 'taunt',
    category: 'taunt',
    layer: 'body',
    disablesIdleProcedural: true,
    parallelWith: ['talking'],
  },
  fistpump: {
    id: 'fistpump',
    category: 'fistpump',
    layer: 'body',
    disablesIdleProcedural: true,
    parallelWith: ['talking'],
  },
  stretch: {
    id: 'stretch',
    category: 'stretch',
    layer: 'body',
    disablesIdleProcedural: true,
  },
  dance: {
    id: 'dance',
    category: 'dance',
    layer: 'body',
    disablesIdleProcedural: true,
    parallelWith: ['talking'],
  },
  kiss: {
    id: 'kiss',
    category: 'kiss',
    layer: 'body',
    disablesIdleProcedural: true,
    autoTrigger: 'idle',
  },
  sleep: {
    id: 'sleep',
    category: 'sleep',
    layer: 'base',
    disablesIdleProcedural: true,
  },
};

/**
 * Utility to check if two actions can run in parallel.
 */
export const canRunInParallel = (actionAId: string, actionBId: string): boolean => {
  const nodeA = ACTION_GRAPH[actionAId];
  const nodeB = ACTION_GRAPH[actionBId];
  
  if (!nodeA || !nodeB) return false;
  if (nodeA.layer !== nodeB.layer) {
    // Different layers are generally okay if specified in parallelWith
    return nodeA.parallelWith?.includes(nodeB.id) || nodeB.parallelWith?.includes(nodeA.id) || false;
  }
  
  return false; // Same layer actions cannot run in parallel unless we implement blending
};

/**
 * Generates Mermaid.js syntax for the current action graph.
 */
export const generateMermaidGraph = (): string => {
  let mermaid = 'graph TD\n';
  Object.values(ACTION_GRAPH).forEach((node) => {
    if (node.parallelWith) {
      node.parallelWith.forEach((pId) => {
        mermaid += `  ${node.id} <--> ${pId}\n`;
      });
    }
    if (node.autoTrigger) {
      mermaid += `  ${node.id} --> ${node.autoTrigger}\n`;
    }
    if (node.disablesIdleProcedural) {
      mermaid += `  ${node.id} -.->|disables| Procedural\n`;
    }
  });
  return mermaid;
};
