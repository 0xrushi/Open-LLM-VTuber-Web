# Action Dependency Graph Implementation Plan

This plan outlines the steps to implement a layered action dependency graph for the VRM avatar, allowing for combined animations (e.g., dancing + talking) and procedural suppression.

## Phase 1: Foundation & Schema
- [x] Create `src/renderer/src/components/canvas/vrm-viewer/action-graph.ts` to define the schema and initial graph data.
- [x] Define `AnimationLayer` types (base, body, face, gestures).
- [x] Map existing animations from `constants.ts` into the new graph structure.

## Phase 2: Animation System Refactoring
- [x] Refactor `use-vrm-animation.ts` to support multiple active animation slots/layers.
- [x] Update `playClipOnCurrentModel` to accept a layer parameter.
- [x] Implement blending/cross-fading between animations on the same layer.

## Phase 3: Procedural & State Management
- [x] Update `VrmAnimationManager.ts` to respect `disablesIdleProcedural` flags from active actions.
- [x] Modify `useVrmSceneActions.ts` to utilize the `ACTION_GRAPH` when triggering animations.
- [x] Implement `autoTrigger` logic to chain actions (e.g., "Love you" -> "Kiss").

## Phase 4: Visualization & UI
- [x] Create a `ActionGraphVisualizer` component using Mermaid.js or a simple SVG tree.
- [x] Integrate the visualizer into the `UiOverlay`.
- [x] Add a debug mode to highlight active paths in the graph.

## Phase 5: Testing & Validation
- [x] Verify concurrent animations (Dance + Talk).
- [x] Verify procedural suppression (No idle sway during complex actions).
- [x] Verify action chaining.
