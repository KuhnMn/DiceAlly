export type Entry =
  | StringEntry
  | ListEntry
  | TableEntry
  | RefSubclassEntry
  | RefClassEntry
  | RefFeatEntry
  | RefOptionalEntry
  | InsetEntry
  | AbilityDCEntry
  | AbilityAttackModEntry
  | OptionsEntry
  | SectionEntry
  | EntriesEntry
  | ListItemEntry
  | ListItemSpellEntry
  | UnknownEntry;

export interface UnknownEntry {
  type?: string;
  [key: string]: unknown;
}

export interface StringEntry {
  type?: string;
  text?: string;
}

export interface ListEntry {
  type: 'list';
  style?: string;
  items: Entry[];
}

export interface TableEntry {
  type: 'table';
  colLabels: string[];
  rows: TableRow[];
}

export type TableRow =
  | Entry[]
  | StructuredTableRow
  | CellTableRow;

export interface StructuredTableRow {
  type: 'row';
  style?: string;
  row: Entry[];
}

export interface CellTableRow {
  type: 'cell';
  width?: number;
  entry: Entry;
}

export interface RefSubclassEntry {
  type: 'refSubclassFeature';
  subclassFeature: string;
}

export interface RefClassEntry {
  type: 'refClassFeature';
  classFeature: string;
}

export interface RefFeatEntry {
  type: 'refFeat';
  feat: string;
}

export interface RefOptionalEntry {
  type: 'refOptionalfeature';
  optionalfeature: string;
}

export interface InsetEntry {
  type: 'inset';
  name: string;
  entries: Entry[];
}

export interface AbilityDCEntry {
  type: 'abilityDC';
  name: string;
  attributes: string[];
}

export interface AbilityAttackModEntry {
  type: 'abilityAttackMod';
  name: string;
  attributes: string[];
}

export interface OptionsEntry {
  type: 'options';
  entries: Entry[];
}

export interface SectionEntry {
  type: 'section';
  entries: Entry[];
}

export interface EntriesEntry {
  type: 'entries';
  name?: string;
  entries: Entry[];
  data?: EntryDataContent;
}

export interface EntryDataContent {
  overwrite: string;
}

export interface ListItemEntry {
  type: 'item';
  name: string;
  entries?: Entry[] | null;
  entry?: Entry | null;
}

export interface ListItemSpellEntry {
  type: 'itemSpell';
  name: string;
  entries?: Entry[] | null;
  entry?: Entry | null;
}

export type ListItem =
  | ObjectListItem
  | ListListItem
  | ObjectListItemSpell
  | StringListItem
  | UnknownListItem;

export interface UnknownListItem {
  type?: string;
  [key: string]: unknown;
}

export interface ObjectListItem {
  type: 'item';
  name: string;
  entries?: Entry[] | null;
  entry?: Entry | null;
}

export interface ListListItem {
  type: 'list';
  style?: string;
  items: ListItem[];
}

export interface ObjectListItemSpell {
  type: 'itemSpell';
  name: string;
  entries?: Entry[] | null;
  entry?: Entry | null;
}

export interface StringListItem {
  text: string;
}

export interface Prerequisite {
  level?: RequisiteLevel;
  other?: string;
  ability?: AbilityScoreRequirement[];
  feat?: string[];
  feature?: string[];
  race?: RaceName[];
  campaign?: string[];
  proficiency?: ProficiencyRequirement[];
  background?: BackgroundRequirement[];
  spell?: RequisiteSpell[];
  item?: string[];
  pact?: string;
  otherSummary?: OtherSummary;
}

export interface RaceName {
  name: string;
}

export interface OtherSummary {
  entrySummary: string;
}

export interface ProficiencyRequirement {
  armor?: string | null;
  weapon?: string | null;
  weaponGroup?: string | null;
}

export interface BackgroundRequirement {
  name: string;
  displayEntry?: string | null;
}

export interface AbilityScoreRequirement {
  str?: number | null;
  dex?: number | null;
  con?: number | null;
  int?: number | null;
  wis?: number | null;
  cha?: number | null;
}

export type RequisiteLevel = ObjectRequisiteLevel | SimpleRequisiteLevel | UnknownRequisite;

export interface ObjectRequisiteLevel {
  level: number;
  class: RequisiteClass;
}

export interface SimpleRequisiteLevel {
  type: 'simple';
  level: number;
}

export interface UnknownRequisite {
  [key: string]: unknown;
}

export interface RequisiteClass {
  name: string;
}

export type RequisiteSpell = ObjectRequisiteSpell | SimpleRequisiteSpell | UnknownRequisite;

export interface ObjectRequisiteSpell {
  choose: string;
  entry: string;
  entrySummary: string;
}

export interface SimpleRequisiteSpell {
  type: 'simple';
  spellName: string;
}

export interface FeatureUses {
  tag?: string;
  totalFreeUses?: number;
  usedFreeUses?: number | 0;
  freeUsesRegainCondition?: string| "LONG_REST";
  userAdded?: boolean;
}

export interface FeatureNotes {
  /** Fingerprint of the wizard's species-choice text; edited groups are left untouched. */
  wizardChoiceHash?: string;
  tag?: string;
  notes: string[];
  isEditable?: boolean | true;
}

export interface AbilityScores {
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
}

export interface Speeds {
  walk?: number;
  swim?: number;
  climb?: number;
  fly?: number;
  burrow?: number;
  [key: string]: number | undefined;
}

export interface SpellClassInfo {
  name: string;
  source: string;
}

export interface SpellTime {
  number?: number;
  unit?: string;
  condition?: string;
}

export interface SpellRange {
  type?: string;
  distance?: { type?: string; amount?: number } | null;
}

export interface MaterialComponent {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

export interface SpellComponents {
  v?: boolean;
  s?: boolean;
  m?: MaterialComponent | string | null;
}

export interface SpellDuration {
  type?: string;
  duration?: { type?: string; amount?: number } | null;
  concentration?: boolean;
}

export interface EntriesHigherLevel {
  type?: string;
  name?: string;
  entries?: Entry[];
}

export interface SpellMeta {
  ritual?: boolean;
}

export interface SpellEntity {
  id?: number;
  name: string;
  level: number;
  school: string;
  source: string;
  classes?: SpellClassInfo[] | null;
  time: SpellTime[];
  range: SpellRange;
  components: SpellComponents;
  duration: SpellDuration[];
  entries: Entry[];
  entriesHigherLevel?: EntriesHigherLevel[] | null;
  meta?: SpellMeta | null;
  damageInflict?: string[] | null;
  spellAttack?: string[] | null;
  areaTags?: string[] | null;
  savingThrow?: string[] | null;
}

export interface FeatureEntity {
  id?: number;
  name: string;
  level: number;
  source: string;
  className: string;
  classSource: string;
  page?: number | null;
  subclassShortName?: string;
  subclassSource?: string;
  entries: Entry[];
}

export interface Ability {
  [key: string]: unknown;
}

export interface FeatEntity {
  id?: number;
  name: string;
  source: string;
  page?: number | null;
  category?: string | null;
  repeatable?: boolean | null;
  entries: Entry[];
  prerequisite?: Prerequisite[] | null;
  ability?: Ability[] | null;
}

export interface Consumes {
  [key: string]: unknown;
}

export interface OptionalFeatureEntity {
  id?: number;
  name: string;
  source: string;
  page?: number | null;
  featureType: string[];
  isClassFeatureVariant?: boolean | null;
  entries: Entry[];
  prerequisite?: Prerequisite[] | null;
  consumes?: Consumes | null;
}

export interface SpeciesEntity {
  id?: number;
  name: string;
  source: string;
  page?: number | null;
  darkvision?: number | null;
  entries?: Entry[] | null;
  size?: string[] | null;
  speed?: Speeds | null;
  creatureTypes?: string[] | null;
  creatureTypeTags?: string[] | null;
  sizeEntry?: ObjectListItem | null;
  resist?: Resistance[] | null;
}

export interface Resistance {
  [key: string]: unknown;
}

export interface ItemEntity {
  id?: number;
  name: string;
  source: string;
  page?: number | null;
  baseItemId?: number | null;
  type?: string | null;
  rarity?: string | null;
  reqAttune?: string | null;
  weight?: number | null;
  entries?: Entry[] | null;
  dmg1?: string | null;
  dmgType?: string | null;
  dmg2?: string | null;
  value?: number | null;
  weaponCategory?: string | null;
  // property?: PropertyEntry[] | null;
  // mastery?: PropertyEntry[] | null;
  range?: string | null;
  bonusWeapon?: string | null;
  bonusAc?: string | null;
  ac?: number | null;
  bonusWeaponAttack?: string | null;
  bonusSavingThrow?: string | null;
  bonusSpellAttack?: string | null;
  bonusSpellSaveDc?: string | null;
  bonusSpellDamage?: string | null;
  bonusWeaponDamage?: string | null;
  scfType?: string | null;
  weapon?: boolean | null;
  armor?: boolean | null;
  sword?: boolean | null;
  axe?: boolean | null;
  spear?: boolean | null;
  crossbow?: boolean | null;
  bow?: boolean | null;
  polearm?: boolean | null;
  arrow?: boolean | null;
  firearm?: boolean | null;
  bolt?: boolean | null;
  bulletFirearm?: boolean | null;
  mace?: boolean | null;
  needleBlowgun?: boolean | null;
  club?: boolean | null;
  bulletSling?: boolean | null;
  hammer?: boolean | null;
  net?: boolean | null;
  cellEnergy?: boolean | null;
  lance?: boolean | null;
}

export interface PropertyEntry {
  name: string;
  entry?: Entry | null;
}

export interface BaseItemEntity {
  id?: number;
  name?: string | null;
  source?: string | null;
  page?: number | null;
  type?: string | null;
  rarity?: string | null;
  reqAttune?: string | null;
  weight?: number | null;
  entries?: Entry[] | null;
  dmg1?: string | null;
  dmgType?: string | null;
  dmg2?: string | null;
  value?: number | null;
  weaponCategory?: string | null;
  property?: PropertyEntry[] | null;
  mastery?: PropertyEntry[] | null;
  range?: string | null;
  bonusWeapon?: string | null;
  bonusAc?: string | null;
  ac?: number | null;
  bonusWeaponAttack?: string | null;
  bonusSavingThrow?: string | null;
  bonusSpellAttack?: string | null;
  bonusSpellSaveDc?: string | null;
  bonusSpellDamage?: string | null;
  bonusWeaponDamage?: string | null;
  scfType?: string | null;
  weapon?: boolean | null;
  armor?: boolean | null;
  sword?: boolean | null;
  axe?: boolean | null;
  spear?: boolean | null;
  crossbow?: boolean | null;
  bow?: boolean | null;
  polearm?: boolean | null;
  arrow?: boolean | null;
  firearm?: boolean | null;
  bolt?: boolean | null;
  bulletFirearm?: boolean | null;
  mace?: boolean | null;
  needleBlowgun?: boolean | null;
  club?: boolean | null;
  bulletSling?: boolean | null;
  hammer?: boolean | null;
  net?: boolean | null;
  cellEnergy?: boolean | null;
  lance?: boolean | null;
}

export interface DisplayProperty {
  name: string;
  entry?: Entry | null;
}

export interface DisplayMastery {
  name: string;
  entry?: Entry | null;
}

export interface DisplayItem {
  item: ItemEntity;
  baseItem?: BaseItemEntity | null;
  itemType?: string | null;
  properties?: DisplayProperty[];
  masteries?: DisplayMastery[];
  page?: number | null;
  ac?: number | null;
  id?: number | null;
}

export interface ContentReference {
  key: string;
  sourceIdentity: string;
  revisionId: string;
  commit: string;
}

export interface SpellEntryFull {
  editorId?: string;
  contentReference?: ContentReference;
  name: string;
  source?: string;
  castingSourceName?: string;
  listType?: string;
  userAdded?: boolean;
  uses?: FeatureUses[];
  notes?: FeatureNotes[];
  entity?: SpellEntity | null;
}

export interface FeatureEntryFull {
  editorId?: string;
  contentReference?: ContentReference;
  name: string;
  source?: string;
  featureSourceName?: string;
  featureType?: string;
  userAdded?: boolean;
  uses?: FeatureUses[];
  notes?: FeatureNotes[];
  featureEntity?: FeatureEntity | null;
  featEntity?: FeatEntity | null;
  optionalFeatureEntity?: OptionalFeatureEntity | null;
}

export interface InventoryItem {
  editorId?: string;
  contentReference?: ContentReference;
  name: string;
  source?: string;
  isEquipped?: boolean;
  isAttuned?: boolean;
  count?: number;
  allowMultiples?: boolean;
  uses?: FeatureUses[];
  notes?: FeatureNotes[];
  entity?: DisplayItem | null;
  isDummy?: boolean; // Marks items created by user without full data
}

export interface Species {
  editorId?: string;
  userAdded?: boolean;
  contentReference?: ContentReference;
  name?: string;
  source?: string;
  uses?: FeatureUses[];
  notes?: FeatureNotes[];
  entity?: SpeciesEntity | null;
}

export interface FeatureSource {
  editorId?: string;
  customDc?: number | null;
  customToHit?: number | null;
  name?: string;
  usesStrength?: boolean;
  usesDexterity?: boolean;
  usesConstitution?: boolean;
  usesIntelligence?: boolean;
  usesWisdom?: boolean;
  usesCharisma?: boolean;
  isGeneralFeatureSource?: boolean;
  isSpellcastingSource?: boolean;
  useSpellbook?: boolean;
  userAdded?: boolean;
}

export interface SpellSlot {
  level: number;
  total: number;
  used: number;
  regainCondition?: string;
  userAdded?: boolean;
}

export type AdvantageType =
  | 'attack_roll'
  | 'saving_throw'
  | 'skill_check'
  | 'ability_check'
  | 'initiative'
  | 'death_save'
  | 'other';

export interface AdvantageOn {
  aType: AdvantageType;
  appliesTo?: string | null;
  isDisadvantage?: boolean;
  condition?: string | null;
}

export interface HitDieEntry {
  total: number;
  used: number;
  dieType: string;
  userAdded?: boolean;
}

export interface MinimalUses {
  tag?: string;
  t: number;
  u: number | 0;
  r?: string;
}

export interface MinimalHitDice {
  t: number;
  u: number;
  dieType: string;
}

export interface MinimalSpellSlotInfo {
  l: number;
  t: number;
  u: number;
  r?: string;
}

export interface CombatSourceSnapshot {
  name?: string;
  range?: string;
  hitOrDc?: string;
  damageOrHeal?: string;
  actionType?: string;
}

export interface CombatAction {
  editorId?: string;
  name?: string;
  range?: string;
  hitOrDc?: string;
  damageOrHeal?: string;
  actionType?: string;
  sourceSnapshot?: CombatSourceSnapshot;
  sourceOption?: number;
  sourceOptionName?: string;
  linkedResourceType?: string;
  linkedResource?: { name?: string; source?: string; editorId?: string };
  orderIndex?: number;
}

export interface Proficiencies {
  languages?: string[];
  savingThrows?: string[];
  skills?: Record<string, string>;
  tools?: Record<string, number> | Record<string, unknown>;
  custom?: string[];
  simpleWeapons?: boolean;
  martialWeapons?: boolean;
  jackOfAllTrades?: boolean;
  initiative?: boolean;
  skillMiscBonuses?: Record<string, number>;
  saveMiscBonuses?: Record<string, number>;
}

export interface CharacterData {
  concentrationEffect?: string;
  concentrationReminderEnabled?: boolean;
  initiativeOverride?: number | null;
  name?: string;
  level?: number;
  description?: string;
  maxHp?: number;
  maxHpOverride?: number | null;
  currentHp?: number;
  tempHp?: number;
  roundTracker?: number;
  armorClass?: number;
  hasInspiration?: boolean;
  abilityScores?: AbilityScores;
  proficiencies?: Proficiencies;
  featureSources?: FeatureSource[];
  hitDice?: HitDieEntry[] | string | null;
  speeds?: Speeds;
  savingThrows?: string[];
  currency?: Record<string, number>;
  spellSlots?: Record<string, SpellSlot[]>;
  advantageOn?: AdvantageOn[];
  resistances?: string[];
  senses?: Record<string, number> | Record<string, unknown>;
  calculateAC?: boolean;
  unarmoredDefense?: string | AbilityScores | null;
  characterUuid?: string;
  deathSavesSuccesses?: number;
  deathSavesFailures?: number;
  armorClassOverride?: number | null;
}

export interface ImmuneResistVulnerable {
  type: string;
  text: string;
}
export interface MonsterInitiative {
  bonus?: number;
  proficiency?: number;
  advantageMode?: string;
}
export interface MonsterAbility {
  name: string;
  entries: Entry[];
}

export interface MonsterAction {
  name: string;
  entries: Entry[];
}

export type MonsterCasting = { entry?: string } | string;

export interface MonsterSpellcasting {
  name: string;
  type?: string;
  headerEntries?: string[];
  ability?: string;
  displayAs?: string;
  will?: MonsterCasting[];
  daily?: Record<string, string[]>;
  known?: Record<string, string[]>;
  constant?: MonsterCasting[];
  ritual?: MonsterCasting[];
  rest?: Record<string, string[]>;
  spells?: Record<string, { slots?: number; spells?: MonsterCasting[] }>;
  footerEntries?: string[];
}

export interface MonsterCR {
  cr: string;
  xp?: number;
}

export interface MonsterEntity {
  id?: number;
  name?: string;
  source?: string;
  page?: number;
  size?: string[];
  type?: { type: string };
  alignment?: string[];
  ac?: (number | { ac?: number; condition?: string; special?: string; from?: string[] })[];
  hp?: { average?: number; formula?: string; special?: string };
  speed?: Record<string, number>;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  save?: Record<string, string> | null;
  skill?: Record<string, string>;
  senses?: string[];
  passive?: string | number;
  immune?: ImmuneResistVulnerable[];
  resist?: ImmuneResistVulnerable[] | null;
  vulnerable?: ImmuneResistVulnerable[] | null;
  conditionImmune?: ImmuneResistVulnerable[];
  languages?: string[];
  cr?: MonsterCR | string;
  initiative?: MonsterInitiative;
  spellcasting?: Array<MonsterSpellcasting | Entry> | null;
  trait?: MonsterAbility[];
  action?: MonsterAction[];
  reaction?: MonsterAction[];
  bonus?: MonsterAction[];
  mythic?: MonsterAction[];
  legendary?: MonsterAction[] | null;
  legendaryActionsLair?: MonsterAction[] | null;
  environment?: string[] | null;
  hasToken?: boolean;
  hasFluff?: boolean;
}

export interface Monster {
  editorId?: string;
  contentReference?: ContentReference;
  uses?: FeatureUses[];
  notes?: FeatureNotes[];
  name?: string;
  source?: string;
  hpEnabled?: boolean;
  monsterMaxHP?: number;
  monsterCurrentHP?: number;
  userAdded?: boolean;
  entity?: MonsterEntity;
  monsterTempHP?: number;
  monsterMaxHpOverride?: number;
}

export interface Note {
  id: number;
  characterId?: number;
  title: string;
  body: string;
  orderIndex?: number;
}

export type ConditionName = string;

export interface ExportedCharacter {
  background?: Background;
  creatorWizard?: {
    revisionId: string;
    classes: { selectionId: string; classKey: string; subclassKey?: string; level: number; spellList?: string; useSpellbook?: boolean }[];
    speciesKey?: string;
    answers: Record<string, string[]>;
    options: Record<string, boolean>;
    baseline: { path: string[]; fingerprint: string; editFingerprint?: string; scope: string; label: string }[];
    protectedPaths: string[][];
  };
  portaitUrl?: string | null;
  character?: CharacterData;
  species?: Species;
  spells?: SpellEntryFull[];
  features?: FeatureEntryFull[];
  inventory?: InventoryItem[];
  combatActions?: CombatAction[];
  conditions?: ConditionName[];
  monsters?: Monster[];
  notes?: Note[];
}

/** A name-only custom background or a detached library reference, without automatic grants. */
export interface Background {
  name: string;
  source?: string;
  contentReference?: ContentReference;
  entity?: { entries?: Entry[]; [key: string]: unknown };
}
