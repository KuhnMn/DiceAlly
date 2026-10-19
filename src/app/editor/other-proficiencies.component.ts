import { UiIconComponent } from '../ui-icon.component';
import { InfoButtonComponent } from '../info-button.component';
import { AppDialogService } from '../services/app-dialog.service';
import { newEditorId } from './editor-identity';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { SourceBookFilterService } from './source-book-filter.service';
import { activeContentRevision } from './active-content-revision';
import { SearchableSelectComponent, SelectOption } from './searchable-select.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

@Component({
  selector: 'app-other-proficiencies', imports: [InfoButtonComponent, UiIconComponent, FormsModule, RouterLink, SearchableSelectComponent, EntryRendererComponent],
  templateUrl: './other-proficiencies.component.html', styleUrl: './editor.css',
  styles: [`
    .source-editor { container-type: inline-size; }
    .source-editor .editor-input { min-width: 0; padding: .375rem .5rem; }
    .source-editor .field-label { margin-bottom: .375rem; }
    .source-option { display: flex; align-items: center; justify-content: center; gap: .375rem;
      min-height: 2.25rem; padding: .375rem; border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: .5rem; cursor: pointer; font-size: .75rem; }
    .source-option:has(input:checked), .source-ability:has(input:checked) {
      background: var(--md-extended-color-custom-color3-color-container);
      color: var(--md-extended-color-custom-color3-on-color-container);
      border-color: var(--md-extended-color-custom-color3-color); }
    .source-casting:has(input:checked) { background: var(--md-extended-color-custom-color5-color-container);
      color: var(--md-extended-color-custom-color5-on-color-container);
      border-color: var(--md-extended-color-custom-color5-color); }
    .source-ability { display: grid; place-items: center; min-height: 2.25rem;
      border: 1px solid var(--md-sys-color-outline-variant); border-radius: .375rem;
      font-size: .6875rem; font-weight: 600; cursor: pointer; }
    .source-ability:has(input:checked) span { text-decoration: underline; text-underline-offset: .2rem; }
    .source-ability:focus-within { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
    .source-option span { white-space: nowrap; }
    @container (max-width: 15rem) {
      .source-option { font-size: .6875rem; gap: .25rem; padding-inline: .25rem; }
      .source-option app-ui-icon { display: none; }
    }
  `],
})
export class OtherProficienciesComponent implements OnInit {
  private readonly dialogs = inject(AppDialogService);
  readonly sheet = input.required<ExportedCharacter>();
  readonly panel = input<'proficiencies' | 'sources'>('proficiencies');
  sourcesVisible = true;
  private readonly customSources = new Set<FeatureSource>();
  usesCustomValues(source: FeatureSource) {
    return this.customSources.has(source) || source.customToHit != null || source.customDc != null;
  }
  setCustomValues(source: FeatureSource, enabled: boolean) {
    if (enabled) this.customSources.add(source);
    else {
      this.customSources.delete(source);
      source.customToHit = null;
      source.customDc = null;
    }
    this.change();
  }
  readonly edited = output<void>();
  readonly tools = signal<ContentRecord[]>([]);
  readonly loadingTools = signal(false);
  readonly toolMessage = signal('');
  readonly sourceMessage = signal('');
  readonly revision = signal<ImportRevision | null>(null);
  private readonly cache = new IndexedDbContentCache();
  private readonly sourceBooks = inject(SourceBookFilterService);
  languageInput = '';
  customInput = '';
  editingCustom: number | null = null;
  readonly combatOptions = [
    { key: 'simpleWeapons', label: 'Simple Weapons' },
    { key: 'martialWeapons', label: 'Martial Weapons' },
    { key: 'initiative', label: 'Initiative Proficiency' },
  ] as const;
  readonly advantageTypes = [
    { value: 'attack_roll', label: 'Attack Roll' }, { value: 'saving_throw', label: 'Saving Throw' },
    { value: 'skill_check', label: 'Skill Check' }, { value: 'ability_check', label: 'Ability Check' },
    { value: 'initiative', label: 'Initiative' }, { value: 'death_save', label: 'Death Save' },
    { value: 'other', label: 'Other' },
  ];
  readonly sourceAbilities: { key: keyof FeatureSource; label: string }[] = [
    { key: 'usesStrength', label: 'STR' }, { key: 'usesDexterity', label: 'DEX' },
    { key: 'usesConstitution', label: 'CON' }, { key: 'usesIntelligence', label: 'INT' },
    { key: 'usesWisdom', label: 'WIS' }, { key: 'usesCharisma', label: 'CHA' },
  ];
  get character() { return this.sheet().character!; }
  get advantages() { return this.character.advantageOn ?? []; }
  get languages() { return this.character.proficiencies?.languages ?? []; }
  get customProficiencies() { return this.character.proficiencies?.custom ?? []; }
  addCustomProficiency() {
    const text = this.customInput.trim();
    if (!text) return;
    ((this.character.proficiencies ??= {}).custom ??= []).push(text);
    this.customInput = ''; this.change();
  }
  updateCustomProficiency(index: number, text: string) {
    this.character.proficiencies!.custom![index] = text; this.change();
  }
  removeCustomProficiency(index: number) {
    this.character.proficiencies!.custom!.splice(index, 1);
    this.editingCustom = null; this.change();
  }
  get toolNames() { return Object.keys(this.character.proficiencies?.tools ?? {}); }
  get sources() { return this.character.featureSources ?? []; }
  get availableTools() {
    return this.tools().filter(tool => this.sourceBooks.allows(tool.publication));
  }
  get toolChoices(): SelectOption[] {
    return this.availableTools.map(tool => ({ value: tool.key, label: `${tool.name} (${tool.publication})` }));
  }
  change() { this.edited.emit(); }
  combatValue(key: 'simpleWeapons' | 'martialWeapons' | 'initiative') { return this.character.proficiencies?.[key] ?? false; }
  setCombat(key: 'simpleWeapons' | 'martialWeapons' | 'initiative', value: boolean) {
    (this.character.proficiencies ??= {})[key] = value; this.change();
  }
  addAdvantage() {
    (this.character.advantageOn ??= []).push({ aType: 'other', appliesTo: '', condition: '', isDisadvantage: false });
    this.change();
  }
  removeAdvantage(index: number) { this.character.advantageOn!.splice(index, 1); this.change(); }
  addLanguage() {
    const language = this.languageInput.trim(); if (!language) return;
    const languages = (this.character.proficiencies ??= {}).languages ??= [];
    if (!languages.some(value => value.toLowerCase() === language.toLowerCase())) languages.push(language);
    this.languageInput = ''; this.change();
  }
  removeLanguage(index: number) { this.character.proficiencies!.languages!.splice(index, 1); this.change(); }
  async ngOnInit() { if (this.panel() === 'proficiencies') await this.loadTools(); }
  async loadTools() {
    this.loadingTools.set(true); this.toolMessage.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      this.revision.set(revision ?? null);
      this.tools.set(revision ? await this.cache.tools(revision.id) : []);
      if (!revision) this.toolMessage.set('Import content to select tools from your library. Existing proficiencies are kept.');
      else if (!this.tools().length) this.toolMessage.set('No tools found in this content import.');
    } catch (error) { this.toolMessage.set(String(error)); }
    finally { this.loadingTools.set(false); }
  }
  addTool(key: string) {
    const tool = this.tools().find(tool => tool.key === key);
    const revision = this.revision(); if (!tool || !revision) return;
    const tools = (this.character.proficiencies ??= {}).tools ??= {};
    tools[`${tool.name} (${tool.publication})`] = { contentKey: tool.key, sourceIdentity: revision.sourceIdentity,
      revisionId: revision.id, snapshot: structuredClone(tool) };
    this.change();
  }
  removeTool(name: string) { delete this.character.proficiencies!.tools![name]; this.change(); }
  addSource() {
    const sources = this.character.featureSources ??= [];
    let name = 'New Source'; let suffix = 2;
    while (sources.some(source => source.name === name)) name = `New Source ${suffix++}`;
    sources.unshift({ editorId: newEditorId(), name, isGeneralFeatureSource: true, isSpellcastingSource: false, userAdded: true }); this.change();
  }
  setSourceAbility(source: FeatureSource, key: keyof FeatureSource, enabled: boolean) {
    Object.assign(source, { [key]: enabled }); this.change();
  }
  renameSource(source: FeatureSource, event: Event) {
    const field = event.target as HTMLInputElement;
    const name = field.value.trim();
    if (!name || this.sources.some(other => other !== source && other.name === name)) {
      field.value = source.name ?? ''; this.sourceMessage.set('Choose a nonempty, unique source name.'); return;
    }
    this.sourceMessage.set('');
    const old = source.name; source.name = name;
    if (old === name) return;
    for (const feature of this.sheet().features ?? []) if (feature.featureSourceName === old) feature.featureSourceName = name;
    for (const spell of this.sheet().spells ?? []) if (spell.castingSourceName === old) spell.castingSourceName = name;
    const slots = this.character.spellSlots;
    if (old && slots && Object.hasOwn(slots, old)) {
      Object.defineProperty(slots, name, { value: [...(Object.hasOwn(slots, name) ? slots[name] : []), ...slots[old]],
        enumerable: true, configurable: true, writable: true });
      delete slots[old];
    }
    this.change();
  }
  async removeSource(index: number) {
    const source = this.sources[index];
    const linked = (this.sheet().features ?? []).some(feature => feature.featureSourceName === source.name)
      || (this.sheet().spells ?? []).some(spell => spell.castingSourceName === source.name) || !!this.character.spellSlots?.[source.name ?? ''];
    if (linked && !await this.dialogs.confirm('Remove this source? Its existing features, spells and slots will be retained.')) return;
    this.character.featureSources!.splice(index, 1); this.change();
  }
}
