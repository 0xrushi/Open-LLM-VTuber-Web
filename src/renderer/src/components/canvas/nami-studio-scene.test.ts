import { describe, expect, it } from 'vitest';
import { createNamiAuthoredEnvironmentRegistry } from './nami-studio-scene';

describe('createNamiAuthoredEnvironmentRegistry', () => {
  it('uses the copied Nami pose hips translation to calibrate desk sitting', () => {
    const registry = createNamiAuthoredEnvironmentRegistry();
    const desk = registry.objects.find((object) => object.id === 'desk');

    expect(desk?.interactionPoints.sit).toEqual([-3.288, 0.94, -2.482]);
  });
});
