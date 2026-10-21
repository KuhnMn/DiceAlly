import { EditorPageModel, EditorFormContext } from './editor-page-model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { DEFENSE_ABILITIES } from './basic-info';
import { AbilityScores, HitDieEntry } from '../models/character.model';
import { AppDialogService } from '../services/app-dialog.service';
import { CharacterSpeed, SPEED_TYPES, SpeedType, primaryWalkingSpeed, walkingSpeedEntry } from '../models/character-speed';

/** Editing actions and transient form state for the basic info page. */
export class BasicInfoEditorModel extends EditorPageModel {
  constructor(context: EditorFormContext, helpers: CharacterHelpersService, private readonly dialogs: AppDialogService) {
    super(context, helpers);
  }

  resetInputs() {
    this.resistanceInput = ''; this.senseName = ''; this.senseRange = 60;
    this.hitDiceTotal = 1; this.hitDiceType = 'd8'; this.portraitFailed = false;
  }

  readonly defenseAbilities = DEFENSE_ABILITIES;
  readonly combatFields = [
    { key: 'level', label: 'Level', minimum: 1 },
    { key: 'maxHp', label: 'Max HP', minimum: 0 },
  ] as const;
  readonly speedTypes = SPEED_TYPES;
  resistanceInput = '';
  senseName = '';
  senseRange: number | null = 60;
  hitDiceTotal: number | null = 1;
  hitDiceType = 'd8';
  readonly dieTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
  portraitFailed = false;
  get resistances() { return this.character.resistances!; }
  get senses() { return Object.entries(this.character.senses ?? {}); }
  get speeds() { return this.character.speeds ??= [walkingSpeedEntry()]; }
  addSpeed() { this.speeds.push({ id: crypto.randomUUID(), type: 'fly', value: { kind: 'walkingSpeed' } }); this.changed(); }
  removeSpeed(speed: CharacterSpeed) { if (speed !== primaryWalkingSpeed(this.speeds)) { this.speeds.splice(this.speeds.indexOf(speed), 1); this.changed(); } }
  isPrimaryWalk(speed: CharacterSpeed) { return speed === primaryWalkingSpeed(this.speeds); }
  setSpeedType(speed: CharacterSpeed, type: SpeedType) {
    const common = { id: speed.id, ...(speed.condition ? { condition: speed.condition } : {}),
      ...(speed.overrideFeet != null ? { overrideFeet: speed.overrideFeet } : {}) };
    const next: CharacterSpeed = type === 'walk'
      ? { ...common, type, value: { kind: 'fixed', feet: speed.value.kind === 'fixed' ? speed.value.feet : 30 } }
      : { ...common, type, value: speed.value, ...(type === 'fly' && speed.type === 'fly' ? { canHover: speed.canHover } : {}) };
    this.speeds[this.speeds.indexOf(speed)] = next; this.changed();
  }
  setSpeedFeet(speed: CharacterSpeed, value: number | null) {
    if (value == null && speed.type === 'walk') return;
    if (value != null) speed.value = { kind: 'fixed', feet: value };
    else if (speed.type !== 'walk') speed.value = { kind: 'walkingSpeed' };
    this.changed();
  }
  setSpeedCondition(speed: CharacterSpeed, value: string) { if (value) speed.condition = value; else delete speed.condition; this.changed(); }
  setSpeedHover(speed: CharacterSpeed, value: boolean) { if (speed.type === 'fly') { speed.canHover = value; this.changed(); } }
  get hitDice(): HitDieEntry[] { return Array.isArray(this.character.hitDice) ? this.character.hitDice : []; }
  get legacyHitDice() { return typeof this.character.hitDice === 'string' ? this.character.hitDice : ''; }
  addHitDice() {
    if (this.legacyHitDice) { this.context.reportError('Replace the imported text with an editable list before adding hit dice.'); return; }
    const total = this.hitDiceTotal;
    const dieType = this.hitDiceType.trim().toLowerCase();
    if (!Number.isSafeInteger(total) || total! < 1 || !/^d[1-9]\d*$/.test(dieType)) {
      this.context.reportError('Enter a positive whole-number total and a die type such as d8.'); return;
    }
    const dice = this.character.hitDice = this.hitDice;
    const existing = dice.find(die => die.dieType.toLowerCase() === dieType);
    if (existing) existing.total += total!;
    else dice.push({ total: total!, used: 0, dieType, userAdded: true });
    this.hitDiceTotal = 1; this.changed();
  }
  adjustHitDice(position: number, change: number) {
    const die = this.hitDice[position];
    die.total = Math.max(0, die.total + change); this.changed();
  }
  removeHitDice(position: number) { this.hitDice.splice(position, 1); this.changed(); }
  async replaceLegacyHitDice() {
    if (!await this.dialogs.confirm('Replace the imported hit-dice text with an empty editable list?')) return;
    this.character.hitDice = []; this.changed();
  }
  get defenseAbility(): keyof AbilityScores {
    const selection = this.character.unarmoredDefense;
    return DEFENSE_ABILITIES.find(a => typeof selection === 'string'
      ? selection.toLowerCase() === a.key : selection?.[a.key] != null)?.key ?? 'constitution';
  }
  get calculatedAc() { return this.helpers.calculateArmorClass(this.character, this.sheet.inventory ?? []); }
  adjust(field: 'level' | 'maxHp' | 'armorClass', change: number) {
    this.character[field] = Math.max(field === 'level' ? 1 : 0, (this.character[field] ?? 0) + change);
    this.changed();
  }
  setAutomaticAc(enabled: boolean) {
    this.character.calculateAC = enabled;
    // A manual AC entry is the value to use, rather than a separate automatic override.
    this.character.armorClassOverride = null;
    this.changed();
  }
  setUnarmoredDefense(enabled: boolean) {
    this.character.unarmoredDefense = enabled ? this.defenseAbility.toUpperCase() : null;
    this.changed();
  }
  setDefenseAbility(ability: keyof AbilityScores) {
    this.character.unarmoredDefense = ability.toUpperCase(); this.changed();
  }
  addResistance() {
    const value = this.resistanceInput.trim();
    if (!value) return;
    if (!this.resistances.some(r => r.toLowerCase() === value.toLowerCase())) this.resistances.push(value);
    this.resistanceInput = ''; this.changed();
  }
  removeResistance(position: number) { this.resistances.splice(position, 1); this.changed(); }
  addSense() {
    const name = this.senseName.trim();
    if (!name || !Number.isSafeInteger(this.senseRange) || this.senseRange! < 0) {
      this.context.reportError('Enter a sense name and a whole-number range of zero or more feet.'); return;
    }
    const existing = Object.keys(this.character.senses!).find(key => key.toLowerCase() === name.toLowerCase());
    Object.defineProperty(this.character.senses!, existing ?? name, { value: this.senseRange, configurable: true, writable: true, enumerable: true });
    this.senseName = ''; this.senseRange = 60; this.changed();
  }
  removeSense(name: string) { delete this.character.senses![name]; this.changed(); }
  updateSense(name: string, range: number) { this.character.senses![name] = range; this.changed(); }

  setPortraitUrl(value: string) {
    if (value.trim() && !/^https?:\/\//i.test(value.trim())) {
      this.context.reportError('Use an http:// or https:// link to an externally hosted portrait.');
      return;
    }
    this.sheet.portaitUrl = value.trim() || null;
    this.portraitFailed = false; this.changed();
  }
  removePortrait() { this.setPortraitUrl(''); }
}
