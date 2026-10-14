import { Component, ElementRef, HostListener, OnInit, ViewChild, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { SourceBookFilterService } from './source-book-filter.service';

@Component({
  selector: 'app-other-proficiencies', imports: [FormsModule, RouterLink],
  templateUrl: './other-proficiencies.component.html', styleUrl: './local-editor.component.css',
})
export class OtherProficienciesComponent implements OnInit {
  readonly sheet = input.required<ExportedCharacter>();
  readonly panel = input<'proficiencies' | 'sources'>('proficiencies');
  readonly edited = output<void>();
  readonly tools = signal<ContentRecord[]>([]);
  readonly loadingTools = signal(false);
  readonly toolMessage = signal('');
  readonly sourceMessage = signal('');
  readonly revision = signal<ImportRevision | null>(null);
  private readonly cache = new IndexedDbContentCache();
  private readonly sourceBooks = inject(SourceBookFilterService);
  selectedTool = '';
  toolSearch = '';
  toolMenuOpen = false;
  @ViewChild('toolPicker') private toolPicker?: ElementRef<HTMLElement>;
  @ViewChild('toolTrigger') private toolTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('toolSearchInput') set toolSearchInput(element: ElementRef<HTMLInputElement> | undefined) {
    element?.nativeElement.focus();
  }
  languageInput = '';
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
  get toolNames() { return Object.keys(this.character.proficiencies?.tools ?? {}); }
  get sources() { return this.character.featureSources ?? []; }
  get filteredTools() {
    const query = this.toolSearch.toLowerCase().trim();
    return this.tools().filter(tool => this.sourceBooks.allows(tool.publication) && `${tool.name} ${tool.publication}`.toLowerCase().includes(query));
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
  toggleToolMenu() { this.toolMenuOpen = !this.toolMenuOpen; if (this.toolMenuOpen) this.toolSearch = ''; }
  chooseTool(key: string) {
    this.selectedTool = key; this.addTool(); this.toolMenuOpen = false;
    this.toolTrigger?.nativeElement.focus();
  }
  @HostListener('document:click', ['$event']) outsideToolPicker(event: MouseEvent) {
    if (this.toolMenuOpen && !this.toolPicker?.nativeElement.contains(event.target as Node)) this.toolMenuOpen = false;
  }
  toolMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.toolMenuOpen = false; this.toolTrigger?.nativeElement.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = Array.from(this.toolPicker?.nativeElement.querySelectorAll<HTMLButtonElement>('[data-tool-option]') ?? []);
      const current = options.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0);
      options[next]?.focus();
    }
  }
  async loadTools() {
    this.loadingTools.set(true); this.toolMessage.set('');
    try {
      const configured = await this.cache.savedSource('development-local');
      const revision = configured ? await this.cache.active('development-local', configured)
        : (await this.cache.revisions('development-local')).find(entry => entry.active && entry.revision.status === 'ready')?.revision;
      this.revision.set(revision ?? null);
      this.tools.set(revision ? await this.cache.tools(revision.id) : []);
      if (!revision) this.toolMessage.set('Import content to select tools from your library. Existing proficiencies are kept.');
      else if (!this.tools().length) this.toolMessage.set('No tools found in this content import.');
    } catch (error) { this.toolMessage.set(String(error)); }
    finally { this.loadingTools.set(false); }
  }
  addTool() {
    const tool = this.tools().find(tool => tool.key === this.selectedTool);
    const revision = this.revision(); if (!tool || !revision) return;
    const tools = (this.character.proficiencies ??= {}).tools ??= {};
    tools[`${tool.name} (${tool.publication})`] = { contentKey: tool.key, sourceIdentity: revision.sourceIdentity,
      revisionId: revision.id, snapshot: structuredClone(tool) };
    this.selectedTool = ''; this.change();
  }
  removeTool(name: string) { delete this.character.proficiencies!.tools![name]; this.change(); }
  addSource() {
    const sources = this.character.featureSources ??= [];
    let name = 'New Source'; let suffix = 2;
    while (sources.some(source => source.name === name)) name = `New Source ${suffix++}`;
    sources.push({ id: crypto.randomUUID(), name, isGeneralFeatureSource: true, isSpellcastingSource: false, userAdded: true }); this.change();
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
  removeSource(index: number) {
    const source = this.sources[index];
    const linked = (this.sheet().features ?? []).some(feature => feature.featureSourceName === source.name)
      || (this.sheet().spells ?? []).some(spell => spell.castingSourceName === source.name) || !!this.character.spellSlots?.[source.name ?? ''];
    if (linked && !confirm('Remove this source? Its existing features, spells and slots will be retained.')) return;
    this.character.featureSources!.splice(index, 1); this.change();
  }
}
