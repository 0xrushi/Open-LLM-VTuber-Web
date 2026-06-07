import { describe, expect, it } from 'vitest';
import { createNamiAuthoredEnvironmentRegistry } from './nami-studio-scene';

describe('createNamiAuthoredEnvironmentRegistry', () => {
  it('computes desk sitting interaction point from authored desk position', () => {
    const registry = createNamiAuthoredEnvironmentRegistry();
    const desk = registry.objects.find((object) => object.id === 'desk');

    expect(desk?.interactionPoints.sit).toEqual([-3.288, 0.907, -2.54]);
  });
});
