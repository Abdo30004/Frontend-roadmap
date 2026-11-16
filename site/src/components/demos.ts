import type { ComponentType } from 'react';

/**
 * Contract for src/demos/<level>/<slug>.tsx
 *  - scenario: one sentence setting the scene (must NOT reveal the cause or the fix)
 *  - task:     what the learner should do to see the bug ("Click Pay twice quickly")
 *  - Problem:  live, working implementation of the BUG
 *  - Solution: live, working implementation of the FIX (same UI, so the difference is obvious)
 */
export interface DemoModule {
  scenario: string;
  task?: string;
  solutionNote?: string;
  Problem: ComponentType;
  Solution: ComponentType;
}

const MODULES = import.meta.glob<DemoModule>('../demos/*/*.tsx');

export function demoLoader(level: string, slug: string) {
  return MODULES[`../demos/${level}/${slug}.tsx`];
}
