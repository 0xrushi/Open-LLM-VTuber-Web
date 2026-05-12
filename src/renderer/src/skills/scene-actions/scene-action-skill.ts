import sceneActionSkillSoul from './soul.md?raw';

export type SceneActionResolution =
  | {
    type: 'scene-action';
    action: string;
    objectId?: string;
    target: 'object' | 'none';
  }
  | {
    type: 'stand';
  };

type SceneObjectAlias = {
  id: string;
  aliases: string[];
};

type SceneActionIntent = {
  action: string;
  intents: string[];
  defaultObjectId?: string;
  requiredObjectAliases?: string[];
  fallbackObjectAliases?: string[];
  fallbackObjectId?: string;
  target: 'object' | 'none';
};

type SceneActionSkill = {
  objects: SceneObjectAlias[];
  actions: SceneActionIntent[];
};

const splitPhrases = (value: string | undefined): string[] => (
  value
    ? value.split('|').map((item) => item.trim()).filter(Boolean)
    : []
);

const parseFields = (block: string[]): Record<string, string> => {
  const fields: Record<string, string> = {};
  block.forEach((line) => {
    const normalizedLine = line.replace(/^- /, '').trim();
    const separatorIndex = normalizedLine.indexOf(':');
    if (separatorIndex < 0) return;
    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1).trim();
    fields[key] = value;
  });
  return fields;
};

const parseListSection = (source: string, heading: string): Array<Record<string, string>> => {
  const headingPattern = new RegExp(`^## ${heading}\\s*$`, 'm');
  const headingMatch = source.match(headingPattern);
  if (!headingMatch || headingMatch.index === undefined) return [];

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeadingIndex = source.slice(sectionStart).search(/^## /m);
  const section = nextHeadingIndex >= 0
    ? source.slice(sectionStart, sectionStart + nextHeadingIndex)
    : source.slice(sectionStart);

  const entries: string[][] = [];
  let current: string[] = [];
  section.split('\n').forEach((line) => {
    if (line.startsWith('- ')) {
      if (current.length) entries.push(current);
      current = [line];
    } else if (current.length && line.trim()) {
      current.push(line);
    }
  });
  if (current.length) entries.push(current);

  return entries.map(parseFields);
};

export const parseSceneActionSkill = (source: string): SceneActionSkill => ({
  objects: parseListSection(source, 'Objects').map((fields) => ({
    id: fields.id,
    aliases: splitPhrases(fields.aliases),
  })).filter((entry) => entry.id && entry.aliases.length),
  actions: parseListSection(source, 'Actions').map((fields) => ({
    action: fields.action,
    intents: splitPhrases(fields.intents),
    defaultObjectId: fields.defaultObjectId,
    requiredObjectAliases: splitPhrases(fields.requiredObjectAliases),
    fallbackObjectAliases: splitPhrases(fields.fallbackObjectAliases),
    fallbackObjectId: fields.fallbackObjectId,
    target: fields.target === 'none' ? 'none' : 'object',
  })).filter((entry) => entry.action && entry.intents.length),
});

const sceneActionSkill = parseSceneActionSkill(sceneActionSkillSoul);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const phraseMatches = (normalizedText: string, phrase: string): boolean => {
  const normalizedPhrase = phrase.toLowerCase().trim();
  if (!normalizedPhrase) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedPhrase)}([^a-z0-9]|$)`, 'i').test(normalizedText);
};

const anyPhraseMatches = (normalizedText: string, phrases: string[] = []): boolean => (
  phrases.some((phrase) => phraseMatches(normalizedText, phrase))
);

export const resolveSceneObjectIdFromSkill = (text: string): string => {
  const normalizedText = text.toLowerCase();
  const alias = sceneActionSkill.objects.find((entry) => anyPhraseMatches(normalizedText, entry.aliases));
  if (alias) return alias.id;

  const registry = (window as any).__AI_SCENE_REGISTRY__;
  const objects = Array.isArray(registry?.objects) ? registry.objects : [];
  const match = objects.find((object: any) => {
    const id = String(object?.id ?? '').toLowerCase().replaceAll('_', ' ');
    const humanName = String(object?.humanName ?? '').toLowerCase();
    return (id.length > 0 && phraseMatches(normalizedText, id))
      || (humanName.length > 0 && phraseMatches(normalizedText, humanName));
  });
  return match?.id ?? '';
};

export const resolveSceneActionFromSkill = (text: string): SceneActionResolution | null => {
  const normalizedText = text.toLowerCase();
  const objectId = resolveSceneObjectIdFromSkill(normalizedText);

  for (const entry of sceneActionSkill.actions) {
    if (!anyPhraseMatches(normalizedText, entry.intents)) continue;
    if (entry.requiredObjectAliases?.length && !anyPhraseMatches(normalizedText, entry.requiredObjectAliases)) continue;

    if (entry.action === 'stand') {
      return { type: 'stand' };
    }

    const fallbackObjectId = entry.fallbackObjectId && anyPhraseMatches(normalizedText, entry.fallbackObjectAliases)
      ? entry.fallbackObjectId
      : '';

    return {
      type: 'scene-action',
      action: entry.action,
      objectId: objectId || entry.defaultObjectId || fallbackObjectId || undefined,
      target: entry.target,
    };
  }

  return null;
};
