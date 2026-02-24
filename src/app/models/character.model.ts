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
  freeUsesRegainCondition?: string;
  userAdded?: boolean;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface BaseItemEntity {
  id?: number;
  name?: string;
  source?: string;
  [key: string]: unknown;
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

export interface SpellEntryFull {
  name: string;
  source?: string;
  castingSourceName?: string;
  listType?: string;
  userAdded?: boolean;
  uses?: FeatureUses[];
  entity?: SpellEntity | null;
}

export interface FeatureEntryFull {
  name: string;
  source?: string;
  featureSourceName?: string;
  featureType?: string;
  userAdded?: boolean;
  uses?: FeatureUses[];
  featureEntity?: FeatureEntity | null;
  featEntity?: FeatEntity | null;
  optionalFeatureEntity?: OptionalFeatureEntity | null;
}

export interface InventoryItem {
  name: string;
  source?: string;
  uses?: FeatureUses[];
  entity?: DisplayItem | null;
}

export interface Species {
  name?: string;
  source?: string;
  uses?: FeatureUses[];
  entity?: SpeciesEntity | null;
}

export interface FeatureSource {
  name?: string;
  usesStrength?: boolean;
  usesDexterity?: boolean;
  usesConstitution?: boolean;
  usesIntelligence?: boolean;
  usesWisdom?: boolean;
  usesCharisma?: boolean;
  isGeneralFeatureSource?: boolean;
  isSpellcastingSource?: boolean;
  userAdded?: boolean;
}

export interface SpellSlot {
  level: number;
  total: number;
  used: number;
  regainCondition?: string;
  userAdded?: boolean;
}

export interface CombatAction {
  name?: string;
  range?: string;
  hitOrDc?: string;
  damageOrHeal?: string;
  actionType?: string;
  linkedResourceType?: string;
  linkedResource?: { name?: string; source?: string };
  orderIndex?: number;
}

export interface Proficiencies {
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
  name?: string;
  level?: number;
  description?: string;
  maxHp?: number;
  currentHp?: number;
  tempHp?: number;
  armorClass?: number;
  hasInspiration?: boolean;
  abilityScores?: AbilityScores;
  proficiencies?: Proficiencies;
  featureSources?: FeatureSource[];
  hitDice?: string | null;
  speeds?: Speeds;
  savingThrows?: string[];
  currency?: Record<string, number>;
  spellSlots?: Record<string, SpellSlot[]>;
  advantageOn?: Array<Record<string, string>>;
  resistances?: string[];
  senses?: Record<string, number> | Record<string, unknown>;
  calculateAC?: boolean;
  unarmoredDefense?: AbilityScores | null;
}

export interface ExportedCharacter {
  character?: CharacterData;
  species?: Species;
  spells?: SpellEntryFull[];
  features?: FeatureEntryFull[];
  inventory?: InventoryItem[];
  combatActions?: CombatAction[];
  conditions?: unknown[];
  monsters?: unknown[];
  notes?: unknown[];
}
