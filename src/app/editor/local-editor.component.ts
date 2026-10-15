import { UiIconComponent } from '../ui-icon.component';
import { ThemePickerComponent } from '../theme-picker.component';
import { ScrollableTabsDirective } from '../scrollable-tabs.directive';
import { AppDialogService } from '../services/app-dialog.service';
import { MonstersEditorComponent } from './monsters-editor.component';
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExportedCharacter, AbilityScores, HitDieEntry } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { canonicalDocument } from '../rules/character-document';
import { CharacterRecord } from '../characters/character-repository';
import { CharacterLibraryService } from '../characters/character-library.service';
import { DEFENSE_ABILITIES, emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { SpellSlotsComponent } from './spell-slots.component';
import { FeaturesEditorComponent } from './features-editor.component';
import { SpellsEditorComponent } from './spells-editor.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { MasonryCardsDirective } from './masonry-cards.directive';
import { ClassWizardComponent } from './class-wizard.component';
import { SpeciesEditorComponent } from './species-editor.component';

@Component({
  selector: 'app-local-editor',
  imports: [UiIconComponent, ThemePickerComponent, ScrollableTabsDirective, FormsModule, RouterLink, OtherProficienciesComponent, SpellSlotsComponent, FeaturesEditorComponent, SpellsEditorComponent, SourceBookFilterComponent, MasonryCardsDirective, ClassWizardComponent, SpeciesEditorComponent, MonstersEditorComponent],
  templateUrl: './local-editor.component.html',
  styleUrl: './local-editor.component.css',
})
export class LocalEditorComponent implements OnInit {
  private readonly dialogs = inject(AppDialogService);
  private readonly view = inject(ChangeDetectorRef);
  private readonly library = inject(CharacterLibraryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly helpers = inject(CharacterHelpersService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly defenseAbilities = DEFENSE_ABILITIES;
  readonly pages = ['Basic Info', 'Ability Scores', 'Proficiencies & More', 'Feature Sources', 'Features & Spells', 'Monsters'];
  get hasCastingSources() { return this.character.featureSources?.some(source => source.isSpellcastingSource && source.name?.trim()) ?? false; }
  get hasSpellSlots() { return Object.values(this.character.spellSlots ?? {}).some(slots => slots.length > 0); }
  readonly savingThrows = DEFENSE_ABILITIES.map(ability => ({ ...ability, abbreviation: ability.key.slice(0, 3) }));
  readonly skills = this.helpers.skillDefinitions.map(skill => ({ ...skill, key: skill.name.toUpperCase().replace(/\s+/g, '_') }));
  readonly proficiencyLevels = [
    { value: 'NONE', label: 'None' }, { value: 'HALF', label: 'Half' },
    { value: 'PROFICIENT', label: 'Full' }, { value: 'EXPERTISE', label: 'Expertise' },
  ] as const;
  page = 0;
  readonly combatFields = [
    { key: 'level', label: 'Level', minimum: 1 },
    { key: 'maxHp', label: 'Max HP', minimum: 0 },
  ] as const;
  readonly speedFields = [
    { key: 'walk', label: 'Walk' }, { key: 'fly', label: 'Fly' },
    { key: 'swim', label: 'Swim' }, { key: 'burrow', label: 'Burrow' },
  ] as const;
  sheet = emptyBasicCharacter();
  version = 0;
  wizardOpen = false;
  applyWizard(sheet: ExportedCharacter) {
    this.sheet = sheet; this.wizardOpen = false; this.changed();
    this.message.set('Wizard prefill applied. Review your character and save when ready.');
  }
  resistanceInput = '';
  senseName = '';
  senseRange: number | null = 60;
  hitDiceTotal: number | null = 1;
  hitDiceType = 'd8';
  readonly dieTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
  portraitFailed = false;
  private savedState = canonicalDocument(this.sheet);
  private portraitRequest = 0;

  get character() { return this.sheet.character!; }
  get resistances() { return this.character.resistances!; }
  get senses() { return Object.entries(this.character.senses ?? {}); }
  get speeds() { return this.character.speeds!; }
  get abilityScores() { return this.character.abilityScores!; }
  get hitDice(): HitDieEntry[] { return Array.isArray(this.character.hitDice) ? this.character.hitDice : []; }
  skillLevel(key: string) { return this.helpers.skillProficiencyLevel(this.character.proficiencies?.skills?.[key]); }
  cycleSkillLevel(key: string) {
    const position = this.proficiencyLevels.findIndex(level => level.value === this.skillLevel(key));
    this.setSkillLevel(key, this.proficiencyLevels[(position + 1) % this.proficiencyLevels.length].value);
  }
  skillBonus(key: string) { return this.character.proficiencies?.skillMiscBonuses?.[key] ?? 0; }
  setSkillLevel(key: string, level: string) {
    const proficiencies = this.character.proficiencies ??= {};
    (proficiencies.skills ??= {})[key] = level; this.changed();
  }
  setSkillBonus(key: string, bonus: number | null) {
    const proficiencies = this.character.proficiencies ??= {};
    const bonuses = proficiencies.skillMiscBonuses ??= {};
    if (bonus === null || bonus === 0) delete bonuses[key];
    else bonuses[key] = bonus;
    this.changed();
  }
  skillTotal(key: string, ability: string) {
    const modifier = this.helpers.modifierNumber(this.helpers.abilityScoreValue(this.character, ability));
    const proficiency = this.helpers.proficiencyBonusValue(this.character, this.skillLevel(key));
    return this.helpers.formatSigned(modifier + proficiency + this.skillBonus(key));
  }
  saveProficient(ability: string) { return this.helpers.isProficientInSavingThrow(this.character, ability); }
  toggleSaveProficiency(ability: string) {
    const proficiencies = this.character.proficiencies ??= {};
    const key = ability.toUpperCase();
    const saves = proficiencies.savingThrows ??= [];
    if (saves.includes(key)) proficiencies.savingThrows = saves.filter(save => save !== key);
    else saves.push(key);
    this.changed();
  }
  saveBonus(ability: string) { return this.character.proficiencies?.saveMiscBonuses?.[ability] ?? 0; }
  setSaveBonus(ability: string, bonus: number | null) {
    const proficiencies = this.character.proficiencies ??= {};
    const bonuses = proficiencies.saveMiscBonuses ??= {};
    if (bonus === null || bonus === 0) delete bonuses[ability];
    else bonuses[ability] = bonus;
    this.changed();
  }
  saveTotal(ability: string) { return this.helpers.formatSigned(this.helpers.savingThrowValue(this.character, ability)); }
  get legacyHitDice() { return typeof this.character.hitDice === 'string' ? this.character.hitDice : ''; }
  addHitDice() {
    if (this.legacyHitDice) { this.error.set('Replace the imported text with an editable list before adding hit dice.'); return; }
    const total = this.hitDiceTotal;
    const dieType = this.hitDiceType.trim().toLowerCase();
    if (!Number.isSafeInteger(total) || total! < 1 || !/^d[1-9]\d*$/.test(dieType)) {
      this.error.set('Enter a positive whole-number total and a die type such as d8.'); return;
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
  abilityModifier(ability: keyof AbilityScores) {
    return this.helpers.formatSigned(this.helpers.modifierNumber(this.abilityScores[ability]));
  }
  adjustAbility(ability: keyof AbilityScores, change: number) {
    this.abilityScores[ability] = Math.max(0, (this.abilityScores[ability] ?? 10) + change);
    this.changed();
  }
  setPage(page: number) {
    this.page = page;
    this.view.markForCheck();
    this.message.set(''); this.error.set('');
  }
  private normalizeAbilities() {
    this.character.abilityScores ??= {};
    for (const ability of this.defenseAbilities) this.character.abilityScores[ability.key] ??= 10;
  }
  get defenseAbility(): keyof AbilityScores {
    const selection = this.character.unarmoredDefense;
    return DEFENSE_ABILITIES.find(a => typeof selection === 'string'
      ? selection.toLowerCase() === a.key : selection?.[a.key] != null)?.key ?? 'constitution';
  }
  get calculatedAc() { return this.helpers.calculateArmorClass(this.character, this.sheet.inventory ?? []); }
  get unsaved() { return canonicalDocument(this.sheet) !== this.savedState; }

  ngOnInit() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      if (data['editorCharacter']) this.open(data['editorCharacter'], true);
    });
  }

  changed() { this.view.markForCheck(); this.message.set(''); this.error.set(''); }
  canLeave() { return !this.unsaved || this.dialogs.confirm('You have unsaved changes. Leave without saving?', 'Unsaved Changes', 'Leave Without Saving'); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.unsaved) { event.preventDefault(); event.returnValue = ''; }
  }

  newCharacter() {
    if (this.busy()) return;
    if (!this.canLeave()) return;
    this.portraitRequest++;
    this.sheet = emptyBasicCharacter(); this.version = 0;
    this.view.markForCheck();
    this.savedState = canonicalDocument(this.sheet);
    this.resetInputs();
  }

  open(entry: CharacterRecord, routeApproved = false) {
    if (this.busy()) return;
    if (!routeApproved && !this.canLeave()) return;
    this.portraitRequest++;
    this.sheet = structuredClone(entry.sheet);
    this.character.level ??= 1; this.character.maxHp ??= 0; this.character.armorClass ??= 10;
    this.character.maxHp = this.character.maxHpOverride ?? this.character.maxHp;
    this.character.armorClass = this.character.armorClassOverride ?? this.character.armorClass;
    this.character.resistances ??= []; this.character.senses ??= {}; this.character.speeds ??= { walk: 30 };
    this.character.speeds.walk ??= 30;
    this.normalizeAbilities();
    this.version = entry.version;
    this.view.markForCheck();
    this.savedState = canonicalDocument(this.sheet);
    this.resetInputs();
    this.message.set('Character loaded.');
  }

  private resetInputs() {
    this.page = 0;
    this.resistanceInput = ''; this.senseName = ''; this.senseRange = 60;
    this.hitDiceTotal = 1; this.hitDiceType = 'd8';
    this.portraitFailed = false; this.error.set(''); this.message.set('');
  }

  async save() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      validateBasicInfo(this.sheet);
      if (this.character.calculateAC) this.character.armorClass = this.calculatedAc.ac;
      this.character.armorClassOverride = null;
      this.character.maxHpOverride = null;
      const snapshot = structuredClone(this.sheet);
      this.version = await this.library.save(snapshot, this.version);
      this.view.markForCheck();
      this.savedState = canonicalDocument(snapshot);
      this.message.set('Character saved on this device.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.busy.set(false); }
  }

  async viewSheet() {
    if (this.busy()) return;
    await this.save();
    if (!this.error() && this.version > 0) await this.router.navigate(['/characters', this.character.characterUuid]);
  }
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
      this.error.set('Enter a sense name and a whole-number range of zero or more feet.'); return;
    }
    const existing = Object.keys(this.character.senses!).find(key => key.toLowerCase() === name.toLowerCase());
    Object.defineProperty(this.character.senses!, existing ?? name, { value: this.senseRange, configurable: true, writable: true, enumerable: true });
    this.senseName = ''; this.senseRange = 60; this.changed();
  }
  removeSense(name: string) { delete this.character.senses![name]; this.changed(); }
  updateSense(name: string, range: number) { this.character.senses![name] = range; this.changed(); }

  setPortraitUrl(value: string) {
    this.portraitRequest++;
    this.sheet.portaitUrl = value.trim() || null;
    this.portraitFailed = false; this.changed();
  }
  removePortrait() { this.setPortraitUrl(''); }
  async choosePortrait(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      this.error.set('Choose a PNG, JPEG, WebP or GIF image.'); return;
    }
    if (file.size > 2 * 1024 * 1024) { this.error.set('Choose an image smaller than 2 MB.'); return; }
    const request = ++this.portraitRequest;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(file);
      });
      if (request !== this.portraitRequest) return;
      this.sheet.portaitUrl = data; this.portraitFailed = false; this.changed();
    } catch (error) { this.error.set(String(error)); }
  }

}
