import { useState } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useAiState } from '@/context/ai-state-context';
import { useInterrupt } from '@/components/canvas/live2d';
import { useChatHistory } from '@/context/chat-history-context';
import { useVAD } from '@/context/vad-context';
import { useMediaCapture } from '@/hooks/utils/use-media-capture';

const sceneObjectAliases: Array<{ id: string; patterns: RegExp[] }> = [
  { id: 'armchair_19', patterns: [/\bdesk chair\b/, /\bnavigation chair\b/, /\bchair at the desk\b/, /\bliving chair\b/, /\blounge chair\b/, /\bgold chair\b/, /\bsofa\b/, /\bcouch\b/, /\bchair\b/] },
  { id: 'bed_1', patterns: [/\bbed\b/] },
  { id: 'treadmill', patterns: [/\btreadmill\b/, /\brunning machine\b/] },
  { id: 'dining_furniture', patterns: [/\bdining furniture\b/, /\bcoffee table\b/, /\btable\b/] },
  { id: 'desk', patterns: [/\bnavigation desk\b/, /\bdesk\b/] },
  { id: 'corner_kitchen_unit', patterns: [/\bkitchen unit\b/, /\bcounter\b/, /\bkitchen\b/] },
  { id: 'storage_1', patterns: [/\bcabinet\b/, /\bstorage\b/, /\bcloset\b/, /\bshelf\b/] },
  { id: 'PROP_CoffeeCup_01', patterns: [/\bcoffee cup\b/, /\bcup\b/, /\bmug\b/] },
  { id: 'APPLIANCE_CoffeeMachine_01', patterns: [/\bcoffee machine\b/, /\bespresso machine\b/] },
  { id: 'DRAWER_Kitchen_01', patterns: [/\bleft drawer\b/, /\bkitchen drawer\b/, /\bdrawer\b/] },
  { id: 'DRAWER_Kitchen_02', patterns: [/\bright drawer\b/, /\bsecond drawer\b/] },
  { id: 'corner_kitchen_unit', patterns: [/\blower cupboard\b/, /\blower cabinet\b/] },
  { id: 'CUPBOARD_Kitchen_Upper_01', patterns: [/\bupper cupboard\b/, /\bupper cabinet\b/] },
  { id: 'WARDROBE_Clothes_01', patterns: [/\bwardrobe\b/, /\bcloset\b/, /\bclothes\b/] },
  { id: 'ROOM_Window_Ocean_01', patterns: [/\bwindow\b/, /\bocean window\b/, /\bsea\b/] },
  { id: 'PROP_Map_World_01', patterns: [/\bworld map\b/, /\bmap\b/] },
  { id: 'PROP_Compass_01', patterns: [/\bcompass\b/] },
  { id: 'PROP_Telescope_01', patterns: [/\btelescope\b/] },
  { id: 'PROP_Sextant_01', patterns: [/\bsextant\b/] },
  { id: 'PROP_WeatherBook_01', patterns: [/\bweather book\b/, /\bbook\b/] },
  { id: 'PROP_TangerineBowl_01', patterns: [/\btangerine bowl\b/, /\btangerines\b/, /\bbowl\b/] },
  { id: 'PROP_TreasureChest_01', patterns: [/\btreasure chest\b/, /\bchest\b/] },
  { id: 'PROP_GoldCoinJar_01', patterns: [/\bgold coin jar\b/, /\bcoin jar\b/, /\bgold\b/] },
  { id: 'PROP_DenDenMushi_01', patterns: [/\bden den mushi\b/, /\bsnail phone\b/, /\bphone\b/] },
  { id: 'PROP_TangerineTree_01', patterns: [/\btangerine tree\b/, /\btree\b/, /\bplant\b/] },
  { id: 'PROP_Lantern_01', patterns: [/\blantern\b/, /\blight\b/] },
  { id: 'PROP_KitchenUtensils_01', patterns: [/\butensils\b/] },
  { id: 'PROP_CupsPlates_01', patterns: [/\bcups\b/, /\bplates\b/] },
  { id: 'PROP_Bottles_01', patterns: [/\bbottles\b/] },
];

const resolveSceneObjectId = (normalizedText: string): string => {
  const alias = sceneObjectAliases.find((entry) => (
    entry.patterns.some((pattern) => pattern.test(normalizedText))
  ));
  if (alias) return alias.id;

  const registry = (window as any).__AI_SCENE_REGISTRY__;
  const objects = Array.isArray(registry?.objects) ? registry.objects : [];
  const match = objects.find((object: any) => {
    const id = String(object?.id ?? '').toLowerCase().replaceAll('_', ' ');
    const humanName = String(object?.humanName ?? '').toLowerCase();
    return (id.length > 0 && normalizedText.includes(id))
      || (humanName.length > 0 && normalizedText.includes(humanName));
  });
  return match?.id ?? '';
};

const dispatchSceneAction = (action: string, objectId: string, sourceText: string): boolean => {
  if (!objectId) return false;
  window.dispatchEvent(new CustomEvent('ai-scene-action', {
    detail: {
      action,
      objectId,
      sourceText,
    },
  }));
  return true;
};

const dispatchSceneActionFromText = (text: string): boolean => {
  const normalized = text.toLowerCase();
  if (/\b(stand up|stand|Get up|get up|rise)\b/i.test(text)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: {
        action: 'stand',
        sourceText: text,
      },
    }));
    return true;
  }

  const objectId = resolveSceneObjectId(normalized);

  if (/\b(sit|seat|sit down)\b/.test(normalized)) {
    return dispatchSceneAction('sit', objectId || 'desk', text);
  }
  if (/\b(sleep|nap|lie down|lay down|go to bed)\b/.test(normalized)) {
    return dispatchSceneAction('sleep', objectId || 'bed_1', text);
  }
  if (/\b(dance|dancing|twerk|groove|bust a move)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'dance', sourceText: text },
    }));
    return true;
  }
  if (/\b(sit animation|sitting animation|sit pose|do a sit pose)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'sit_animation', sourceText: text },
    }));
    return true;
  }
  if (/\b(talk animation|talking animation|speak animation|speaking pose)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'talking_animation', sourceText: text },
    }));
    return true;
  }
  if (/\b(taunt|taunting|mock|insult pose|threaten)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'taunting', sourceText: text },
    }));
    return true;
  }
  if (/\b(think pose|thinking animation|ponder|plotting)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'thinking_animation', sourceText: text },
    }));
    return true;
  }
  if (/\b(fist ?pump|victory pose|celebrate)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'fist_pump', sourceText: text },
    }));
    return true;
  }
  if (/\b(stretch|yawn|shoulder rub|neck stretch)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'stretch_yawn_shoulder', sourceText: text },
    }));
    return true;
  }
  if (/\b(give me kiss|kiss me|blow( me)? a kiss|send( me)? a kiss)\b/.test(normalized)) {
    window.dispatchEvent(new CustomEvent('ai-scene-action', {
      detail: { action: 'kiss', sourceText: text },
    }));
    return true;
  }
  if (/\b(open)\b/.test(normalized)) {
    return dispatchSceneAction('open', objectId, text);
  }
  if (/\b(close|shut)\b/.test(normalized)) {
    return dispatchSceneAction('close', objectId, text);
  }
  if (/\b(pick( up| a| some)?|grab|take)\b/.test(normalized)) {
    return dispatchSceneAction('pickUp', objectId || (/\b(cup|mug)\b/.test(normalized) ? 'PROP_CoffeeCup_01' : ''), text);
  }
  if (/\b(run|jog|walk)\b/.test(normalized) && /\btreadmill\b/.test(normalized)) {
    return dispatchSceneAction(/\b(run|jog)\b/.test(normalized) ? 'runOn' : 'walkOn', objectId || 'treadmill', text);
  }
  if (/\b(use|make coffee|brew)\b/.test(normalized) && /\b(coffee machine|espresso machine|kitchen)\b/.test(normalized)) {
    return dispatchSceneAction('use', objectId || 'APPLIANCE_CoffeeMachine_01', text);
  }
  if (/\b(go to|walk to|move to|approach)\b/.test(normalized)) {
    return dispatchSceneAction('moveTo', objectId, text);
  }
  if (/\b(read)\b/.test(normalized)) {
    return dispatchSceneAction('read', objectId, text);
  }
  if (/\b(inspect|examine|look at)\b/.test(normalized)) {
    return dispatchSceneAction('inspect', objectId, text);
  }
  if (/\b(look out|look through)\b/.test(normalized)) {
    return dispatchSceneAction('lookOut', objectId || 'ROOM_Window_Ocean_01', text);
  }
  if (/\b(call|phone)\b/.test(normalized)) {
    return dispatchSceneAction('call', objectId || 'PROP_DenDenMushi_01', text);
  }
  if (/\b(toggle|turn on|turn off|switch)\b/.test(normalized)) {
    return dispatchSceneAction('toggleLight', objectId || 'PROP_Lantern_01', text);
  }

  return false;
};

export function useTextInput() {
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const wsContext = useWebSocket();
  const { aiState } = useAiState();
  const { interrupt } = useInterrupt();
  const { appendHumanMessage } = useChatHistory();
  const { stopMic, autoStopMic } = useVAD();
  const { captureAllMedia } = useMediaCapture();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const trimmedText = inputText.trim();

    // Scene actions are purely frontend — dispatch them even without a backend connection.
    const handledSceneAction = dispatchSceneActionFromText(trimmedText);
    if (handledSceneAction) {
      appendHumanMessage(trimmedText);
      if (autoStopMic) stopMic();
      setInputText('');
      return;
    }

    if (!wsContext) return;
    if (aiState === 'thinking-speaking') {
      interrupt();
    }

    const images = await captureAllMedia();

    appendHumanMessage(trimmedText);
    wsContext.sendMessage({
      type: 'text-input',
      text: trimmedText,
      images,
    });

    if (autoStopMic) stopMic();
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  return {
    inputText,
    setInputText: handleInputChange,
    handleSend,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
