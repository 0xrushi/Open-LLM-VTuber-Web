import { describe, expect, it } from 'vitest';
import { parseSceneActionSkill, resolveSceneActionFromSkill } from './scene-action-skill';

describe('scene action skill', () => {
  it('parses object aliases and action intents from markdown source', () => {
    const skill = parseSceneActionSkill(`
## Objects

- id: chair_1
  aliases: chair | seat

## Actions

- action: sit
  intents: sit | sit down
  defaultObjectId: chair_1
`);

    expect(skill.objects).toEqual([{ id: 'chair_1', aliases: ['chair', 'seat'] }]);
    expect(skill.actions).toEqual([{
      action: 'sit',
      intents: ['sit', 'sit down'],
      defaultObjectId: 'chair_1',
      requiredObjectAliases: [],
      fallbackObjectAliases: [],
      fallbackObjectId: undefined,
      target: 'object',
    }]);
  });

  it('resolves broad scene actions from the skill source', () => {
    expect(resolveSceneActionFromSkill('sit down at the desk')).toMatchObject({
      type: 'scene-action',
      action: 'sit',
      objectId: 'desk',
    });
    expect(resolveSceneActionFromSkill('go walk on the treadmill')).toMatchObject({
      type: 'scene-action',
      action: 'walkOn',
      objectId: 'treadmill',
    });
    expect(resolveSceneActionFromSkill('jog on the treadmill')).toMatchObject({
      type: 'scene-action',
      action: 'runOn',
      objectId: 'treadmill',
    });
  });

  it('keeps avatar-only animation intents separate from object actions', () => {
    expect(resolveSceneActionFromSkill('do a sit animation')).toMatchObject({
      type: 'scene-action',
      action: 'sit_animation',
      target: 'none',
    });
    expect(resolveSceneActionFromSkill('please dance')).toMatchObject({
      type: 'scene-action',
      action: 'dance',
      target: 'none',
    });
    expect(resolveSceneActionFromSkill('stand up')).toEqual({ type: 'stand' });
  });

  it('does not treat regular walking as treadmill walking without the treadmill intent', () => {
    expect(resolveSceneActionFromSkill('walk to the bed')).toMatchObject({
      type: 'scene-action',
      action: 'moveTo',
      objectId: 'bed_1',
    });
  });
});
