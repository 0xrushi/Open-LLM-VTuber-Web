import { describe, it, expect } from 'vitest';
import { ACTION_GRAPH, canRunInParallel, generateMermaidGraph, AnimationLayer, ActionNode } from './action-graph';

describe('ACTION_GRAPH', () => {
  it('should define all expected action nodes', () => {
    const expectedIds = [
      'idle', 'thinking', 'talking', 'walking', 'sit', 'taunt',
      'fistpump', 'stretch', 'dance', 'kiss', 'sleep',
    ];
    expectedIds.forEach((id) => {
      expect(ACTION_GRAPH[id]).toBeDefined();
      expect(ACTION_GRAPH[id].id).toBe(id);
    });
  });

  it('should have correct layer assignments', () => {
    expect(ACTION_GRAPH.idle.layer).toBe('base');
    expect(ACTION_GRAPH.talking.layer).toBe('face');
    expect(ACTION_GRAPH.dance.layer).toBe('body');
    expect(ACTION_GRAPH.fistpump.layer).toBe('body');
  });

  it('should correctly mark actions that disable idle procedural', () => {
    expect(ACTION_GRAPH.idle.disablesIdleProcedural).toBe(false);
    expect(ACTION_GRAPH.talking.disablesIdleProcedural).toBe(false);
    expect(ACTION_GRAPH.walking.disablesIdleProcedural).toBe(true);
    expect(ACTION_GRAPH.dance.disablesIdleProcedural).toBe(true);
    expect(ACTION_GRAPH.sleep.disablesIdleProcedural).toBe(true);
  });

  it('should define parallelWith relationships', () => {
    expect(ACTION_GRAPH.talking.parallelWith).toContain('dance');
    expect(ACTION_GRAPH.dance.parallelWith).toContain('talking');
    expect(ACTION_GRAPH.walking.parallelWith).toContain('talking');
    expect(ACTION_GRAPH.idle.parallelWith).toContain('talking');
  });

  it('should define autoTrigger for kiss action', () => {
    expect(ACTION_GRAPH.kiss.autoTrigger).toBe('idle');
  });

  it('should not have autoTrigger for non-chaining actions', () => {
    expect(ACTION_GRAPH.idle.autoTrigger).toBeUndefined();
    expect(ACTION_GRAPH.dance.autoTrigger).toBeUndefined();
    expect(ACTION_GRAPH.walking.autoTrigger).toBeUndefined();
  });
});

describe('canRunInParallel', () => {
  it('should return false for unknown action IDs', () => {
    expect(canRunInParallel('unknown', 'idle')).toBe(false);
    expect(canRunInParallel('idle', 'unknown')).toBe(false);
    expect(canRunInParallel('unknown', 'unknown')).toBe(false);
  });

  it('should return false for same-layer actions without explicit parallelWith', () => {
    expect(canRunInParallel('idle', 'thinking')).toBe(false);
    expect(canRunInParallel('dance', 'taunt')).toBe(false);
  });

  it('should return false for same-layer actions even if listed in parallelWith', () => {
    expect(canRunInParallel('idle', 'idle')).toBe(false);
  });

  it('should return true for different-layer actions listed in parallelWith', () => {
    expect(canRunInParallel('talking', 'dance')).toBe(true);
    expect(canRunInParallel('dance', 'talking')).toBe(true);
    expect(canRunInParallel('walking', 'talking')).toBe(true);
  });

  it('should return false for different-layer actions not in parallelWith', () => {
    expect(canRunInParallel('sleep', 'dance')).toBe(false);
    expect(canRunInParallel('stretch', 'talking')).toBe(false);
  });
});

describe('generateMermaidGraph', () => {
  it('should generate valid Mermaid graph syntax', () => {
    const mermaid = generateMermaidGraph();
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toMatch(/\n$/);
  });

  it('should include parallelWith edges using bidirectional arrow', () => {
    const mermaid = generateMermaidGraph();
    expect(mermaid).toContain('talking <--> dance');
    expect(mermaid).toContain('talking <--> idle');
  });

  it('should include autoTrigger edges using directional arrow', () => {
    const mermaid = generateMermaidGraph();
    expect(mermaid).toContain('kiss --> idle');
  });

  it('should mark actions that disable idle procedural', () => {
    const mermaid = generateMermaidGraph();
    expect(mermaid).toContain('walking -.->|disables| Procedural');
    expect(mermaid).toContain('dance -.->|disables| Procedural');
  });

  it('should not include autoTrigger edges for actions without autoTrigger', () => {
    const mermaid = generateMermaidGraph();
    const autoTriggerMatches = mermaid.match(/\s+\w+\s+-->\s+\w+/g) ?? [];
    expect(autoTriggerMatches.length).toBe(1);
  });
});
