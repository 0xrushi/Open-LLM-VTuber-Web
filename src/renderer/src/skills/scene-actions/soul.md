# Scene Actions Skill Soul

This is the stable contract for scene-action intent handling.
It should stay small, curated, and human-reviewed.

Do not put secrets, conversation fragments, tool output, or untrusted scraped content here.
Changes to this file alter what the frontend treats as actionable scene intent.

## Objects

- id: armchair_19
  aliases: desk chair | navigation chair | chair at the desk | living chair | lounge chair | gold chair | sofa | couch | chair
- id: bed_1
  aliases: bed
- id: treadmill
  aliases: treadmill | running machine
- id: dining_furniture
  aliases: dining furniture | coffee table | table
- id: desk
  aliases: navigation desk | desk
- id: corner_kitchen_unit
  aliases: kitchen unit | counter | kitchen | lower cupboard | lower cabinet
- id: storage_1
  aliases: cabinet | storage | closet | shelf
- id: PROP_CoffeeCup_01
  aliases: coffee cup | cup | mug
- id: APPLIANCE_CoffeeMachine_01
  aliases: coffee machine | espresso machine
- id: DRAWER_Kitchen_01
  aliases: left drawer | kitchen drawer | drawer
- id: DRAWER_Kitchen_02
  aliases: right drawer | second drawer
- id: CUPBOARD_Kitchen_Upper_01
  aliases: upper cupboard | upper cabinet
- id: WARDROBE_Clothes_01
  aliases: wardrobe | clothes
- id: ROOM_Window_Ocean_01
  aliases: window | ocean window | sea
- id: PROP_Map_World_01
  aliases: world map | map
- id: PROP_Compass_01
  aliases: compass
- id: PROP_Telescope_01
  aliases: telescope
- id: PROP_Sextant_01
  aliases: sextant
- id: PROP_WeatherBook_01
  aliases: weather book | book
- id: PROP_TangerineBowl_01
  aliases: tangerine bowl | tangerines | bowl
- id: PROP_TreasureChest_01
  aliases: treasure chest | chest
- id: PROP_GoldCoinJar_01
  aliases: gold coin jar | coin jar | gold
- id: PROP_DenDenMushi_01
  aliases: den den mushi | snail phone | phone
- id: PROP_TangerineTree_01
  aliases: tangerine tree | tree | plant
- id: PROP_Lantern_01
  aliases: lantern | light
- id: PROP_KitchenUtensils_01
  aliases: utensils
- id: PROP_CupsPlates_01
  aliases: cups | plates
- id: PROP_Bottles_01
  aliases: bottles

## Actions

- action: stand
  intents: stand up | stand | get up | rise
- action: sit_animation
  intents: sit animation | sitting animation | sit pose | do a sit pose
  target: none
- action: talking_animation
  intents: talk animation | talking animation | speak animation | speaking pose
  target: none
- action: taunting
  intents: taunt | taunting | mock | insult pose | threaten
  target: none
- action: thinking_animation
  intents: think pose | thinking animation | ponder | plotting
  target: none
- action: fist_pump
  intents: fist pump | fistpump | victory pose | celebrate
  target: none
- action: stretch_yawn_shoulder
  intents: stretch | yawn | shoulder rub | neck stretch
  target: none
- action: dance
  intents: dance | dancing | twerk | groove | bust a move
  target: none
- action: kiss
  intents: give me kiss | kiss me | blow a kiss | blow me a kiss | send a kiss | send me a kiss
  target: none
- action: sleep
  intents: sleep | nap | lie down | lay down | go to bed
  defaultObjectId: bed_1
- action: sit
  intents: sit | seat | sit down | take a seat
  defaultObjectId: desk
- action: runOn
  intents: run | jog
  requiredObjectAliases: treadmill | running machine
  defaultObjectId: treadmill
- action: walkOn
  intents: walk
  requiredObjectAliases: treadmill | running machine
  defaultObjectId: treadmill
- action: use
  intents: use | make coffee | brew
  requiredObjectAliases: coffee machine | espresso machine | kitchen
  defaultObjectId: APPLIANCE_CoffeeMachine_01
- action: lookOut
  intents: look out | look through
  defaultObjectId: ROOM_Window_Ocean_01
- action: call
  intents: call | phone
  defaultObjectId: PROP_DenDenMushi_01
- action: toggleLight
  intents: toggle | turn on | turn off | switch
  defaultObjectId: PROP_Lantern_01
- action: open
  intents: open
- action: close
  intents: close | shut
- action: pickUp
  intents: pick | pick up | pick a | pick some | grab | take
  fallbackObjectAliases: cup | mug
  fallbackObjectId: PROP_CoffeeCup_01
- action: moveTo
  intents: go to | walk to | move to | approach
- action: read
  intents: read
- action: inspect
  intents: inspect | examine | look at
