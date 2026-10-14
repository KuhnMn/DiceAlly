import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { ExportedCharacter, FeatureSource, SpellEntryFull } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { DEFENSE_ABILITIES } from './basic-info';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SpellCatalogFilter, SpellList, matchesSpell, spellClasses, spellIdentity, spellSnapshot } from './spell-selection';

@Component({
  selector: 'app-editor-spells',
  imports: [FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent],
  templateUrl: './spells-editor.component.html',
  styleUrl: './local-editor.component.css',
})
export class SpellsEditorComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly openSources = output<void>();
  readonly revision = signal<ImportRevision | null>(null);
  readonly results = signal<ContentRecord[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly adding = signal(false);
  readonly message = signal('');
  readonly classNames = signal<string[]>([]);
  readonly publications = signal<string[]>([]);
  readonly levels = Array.from({ length: 10 }, (_, level) => level);
  readonly pageSize = 30;
  readonly expanded = new Set<SpellEntryFull>();
  private readonly cache = new IndexedDbContentCache();
  readonly helpers = inject(CharacterHelpersService);
  private request = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  list: SpellList = 'KNOWN';
  levelFilter = -1;
  filter: SpellCatalogFilter = { search: '', className: '', maximumLevel: 9, publication: '' };
  offset = 0;
  customName = '';
  customLevel = 0;
  customDescription = '';

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isSpellcastingSource && source.name?.trim()); }
  get orphanSources() {
    return [...new Set(this.spells.map(spell => spell.castingSourceName ?? ''))]
      .filter(name => !this.sources.some(source => source.name === name));
  }
  get targetSource() { return this.selectedSource === undefined ? this.sources[0]?.name : this.selectedSource || undefined; }
  get spells() { return this.sheet().spells ?? []; }
  get showSpellbook() { return this.sources.some(source => source.useSpellbook) || this.spells.some(spell => spell.listType === 'SPELLBOOK'); }
  get lists(): SpellList[] { return this.showSpellbook ? ['KNOWN', 'SPELLBOOK', 'PREPARED'] : ['KNOWN', 'PREPARED']; }
  get selected() {
    return this.spells.filter(spell => spell.listType === this.list
      && (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)
      && (this.levelFilter < 0 || spell.entity?.level === this.levelFilter))
      .sort((a, b) => (a.entity?.level ?? 0) - (b.entity?.level ?? 0) || a.name.localeCompare(b.name));
  }
  label(list: SpellList) { return list === 'KNOWN' ? 'Known' : list === 'SPELLBOOK' ? 'Spellbook' : 'Prepared'; }
  count(list: SpellList) { return this.spells.filter(spell => spell.listType === list && (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)).length; }
  setSource(name: string) { this.sourceFilter = name; if (name !== 'ALL') this.selectedSource = name; }
  sourceStats(source: FeatureSource) {
    const character = this.sheet().character!;
    const proficiency = this.helpers.proficiencyBonus(character);
    const stats: { ability: string; attack: string; save?: number }[] = DEFENSE_ABILITIES
      .filter(ability => source[`uses${ability.label}` as keyof FeatureSource])
      .map(ability => {
        const modifier = this.helpers.modifierNumber(character.abilityScores?.[ability.key]);
        return { ability: ability.key.slice(0, 3).toUpperCase(), attack: this.helpers.formatSigned(source.customToHit ?? modifier + proficiency), save: source.customDc ?? 8 + modifier + proficiency };
      });
    if (!stats.length && (source.customDc != null || source.customToHit != null)) stats.push({ ability: 'CUSTOM', attack: source.customToHit == null ? '—' : this.helpers.formatSigned(source.customToHit), save: source.customDc ?? undefined });
    return stats;
  }
  hasList(spell: SpellEntryFull, list: SpellList) { return this.spells.some(entry => spellIdentity(entry) === spellIdentity(spell) && entry.listType === list); }
  usesSpellbook(spell: SpellEntryFull) { return this.sources.some(source => source.name === spell.castingSourceName && source.useSpellbook); }
  change() { this.edited.emit(); }
  toggle(spell: SpellEntryFull) { this.expanded.has(spell) ? this.expanded.delete(spell) : this.expanded.add(spell); }
  addToList(spell: SpellEntryFull, list: SpellList) {
    if (this.hasList(spell, list) || (list === 'SPELLBOOK' && !this.usesSpellbook(spell))) return;
    const copy = structuredClone(spell);
    copy.editorId = crypto.randomUUID(); copy.listType = list;
    (this.sheet().spells ??= []).push(copy); this.change();
  }
  remove(spell: SpellEntryFull) {
    // Android retains a known entry while its prepared version exists.
    if (spell.listType === 'KNOWN' && this.hasList(spell, 'PREPARED')) return;
    if ((spell.notes?.length || spell.uses?.length) && !confirm(`Remove ${spell.name} from ${spell.listType?.toLowerCase()} and delete its notes/use settings?`)) return;
    const index = this.spells.indexOf(spell);
    if (index < 0) return;
    this.spells.splice(index, 1); this.expanded.delete(spell); this.change();
  }
  isAdded(record: ContentRecord, source = this.targetSource) {
    return this.spells.some(spell => spell.castingSourceName === source
      && (spell.contentReference?.key === record.key || (!spell.contentReference && spell.name === record.name && spell.source === record.publication)));
  }
  private entry(record: ContentRecord, revision: ImportRevision, source: string | undefined): SpellEntryFull {
    return { editorId: crypto.randomUUID(), name: record.name, source: record.publication, castingSourceName: source,
      listType: 'KNOWN', userAdded: true, notes: [], uses: [], entity: spellSnapshot(record),
      contentReference: { key: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit } };
  }
  add(record: ContentRecord) {
    const revision = this.revision();
    if (!revision || record.kind !== 'spell' || this.isAdded(record)) return;
    (this.sheet().spells ??= []).push(this.entry(record, revision, this.targetSource)); this.change();
  }
  async addMatching() {
    const revision = this.revision(); if (!revision || this.adding()) return;
    // Capture the exact query and destination before awaiting IndexedDB. Commit only after success.
    const filter = { ...this.filter }; const source = this.targetSource; const sheet = this.sheet();
    this.adding.set(true);
    try {
      const result = await this.cache.searchCategory(revision.id, ['spell'], '', 0, Number.MAX_SAFE_INTEGER, record => matchesSpell(record, filter));
      if (this.destroyed || this.sheet() !== sheet) return;
      const additions = result.records.filter(record => !this.isAdded(record, source)).map(record => this.entry(record, revision, source));
      (sheet.spells ??= []).push(...additions);
      if (additions.length) this.change();
      this.message.set(`Added ${additions.length} spells to Known${source ? ` · ${source}` : ''}. ${result.total - additions.length} already available.`);
    } catch (error) { this.message.set(`Could not add spells: ${String(error)}`); }
    finally { this.adding.set(false); }
  }
  addCustom() {
    const name = this.customName.trim();
    if (!name || !Number.isInteger(this.customLevel) || this.customLevel < 0 || this.customLevel > 9) return;
    const spell: SpellEntryFull = { editorId: crypto.randomUUID(), name, source: 'Custom', castingSourceName: this.targetSource,
      listType: 'KNOWN', userAdded: true, notes: [], uses: [], entity: { name, source: 'Custom', level: this.customLevel,
        school: '', time: [], range: {}, components: {}, duration: [], entries: this.customDescription ? [{ text: this.customDescription }] : [] } };
    (this.sheet().spells ??= []).push(spell); this.customName = ''; this.customDescription = ''; this.change();
  }
  async ngOnInit() { await this.refreshContent(); }
  ngOnDestroy() { this.destroyed = true; this.request++; clearTimeout(this.searchTimer); }
  async refreshContent() {
    const request = ++this.request; this.loading.set(true);
    try {
      const source = await this.cache.savedSource('development-local');
      const revision = source ? await this.cache.active('development-local', source)
        : (await this.cache.revisions('development-local')).find(row => row.active && row.revision.status === 'ready')?.revision;
      if (request !== this.request) return;
      this.revision.set(revision ?? null);
      this.results.set([]); this.total.set(0);
      if (!revision) { this.message.set('Import content to browse spells. Saved spells remain available without the catalog.'); return; }
      const classes = new Set<string>(); const publications = new Set<string>();
      await this.cache.searchCategory(revision.id, ['spell'], '', 0, 0, record => {
        spellClasses(record.data).forEach(entry => classes.add(entry.name)); publications.add(record.publication); return false;
      });
      if (request !== this.request) return;
      this.classNames.set([...classes].sort()); this.publications.set([...publications].sort());
      this.offset = 0; await this.searchContent();
    } catch (error) { if (request === this.request) this.message.set(String(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }
  filterChanged() {
    clearTimeout(this.searchTimer); this.offset = 0; this.request++; this.results.set([]); this.total.set(0); this.loading.set(false);
    this.searchTimer = setTimeout(() => void this.searchContent(), 200);
  }
  async searchContent() {
    const revision = this.revision(); if (!revision) return;
    const request = ++this.request; const filter = { ...this.filter }; this.loading.set(true);
    try {
      const page = await this.cache.searchCategory(revision.id, ['spell'], '', this.offset, this.pageSize, record => matchesSpell(record, filter));
      if (request !== this.request) return;
      this.results.set(page.records); this.total.set(page.total); this.message.set('');
    } catch (error) { if (request === this.request) this.message.set(String(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }
  nextPage(direction: number) { this.offset = Math.max(0, this.offset + direction * this.pageSize); void this.searchContent(); }
}
