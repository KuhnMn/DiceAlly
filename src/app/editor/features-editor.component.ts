import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision, JsonObject, entityKey } from '../content/content.model';
import { Entry, ExportedCharacter, FeatureEntryFull, FeatureEntity, FeatEntity, OptionalFeatureEntity, FeatureSource } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { DEFENSE_ABILITIES } from './basic-info';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { EntryAnnotationsEditor } from './entry-annotations-editor';

type FeatureType = 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE';
export const FEATURE_TYPES: { value: FeatureType; label: string; kinds: string[] }[] = [
  { value: 'CLASS_FEATURE', label: 'Class Features', kinds: ['classFeature', 'subclassFeature'] },
  { value: 'FEAT', label: 'Feats', kinds: ['feat'] },
  { value: 'OPTIONAL_FEATURE', label: 'Optional Features', kinds: ['optionalfeature'] },
];

@Component({
  selector: 'app-editor-features', imports: [FormsModule, RouterLink, EntryRendererComponent],
  templateUrl: './features-editor.component.html', styleUrl: './local-editor.component.css',
})
export class FeaturesEditorComponent extends EntryAnnotationsEditor implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly openSources = output<void>();
  readonly types = FEATURE_TYPES;
  readonly results = signal<ContentRecord[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly message = signal('');
  readonly revision = signal<ImportRevision | null>(null);
  private readonly cache = new IndexedDbContentCache();
  private readonly helpers = inject(CharacterHelpersService);
  private request = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  selectedType: FeatureType = 'CLASS_FEATURE';
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  search = '';
  offset = 0;
  readonly pageSize = 30;
  customName = '';
  customDescription = '';
  readonly expanded = new Set<FeatureEntryFull>();

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isGeneralFeatureSource && source.name); }
  get targetSource() { return this.selectedSource === undefined ? this.sources[0]?.name : this.selectedSource || undefined; }
  hasSource(name: string) { return this.sources.some(source => source.name === name); }
  get unassignedFeatures() { return (this.sheet().features ?? []).some(feature => !feature.featureSourceName); }
  sourceStats(source: FeatureSource) {
    const character = this.sheet().character!;
    const proficiency = this.helpers.proficiencyBonus(character);
    const stats: { ability: string; attack: string; save?: number }[] = DEFENSE_ABILITIES.filter(ability => source[`uses${ability.label}` as keyof FeatureSource]).map(ability => {
      const modifier = this.helpers.modifierNumber(character.abilityScores?.[ability.key]);
      return { ability: ability.key.slice(0, 3).toUpperCase(), attack: this.helpers.formatSigned(source.customToHit ?? modifier + proficiency), save: source.customDc ?? 8 + modifier + proficiency };
    });
    if (!stats.length && (source.customToHit != null || source.customDc != null)) stats.push({ ability: 'CUSTOM',
      attack: source.customToHit == null ? '—' : this.helpers.formatSigned(source.customToHit), save: source.customDc ?? undefined });
    return stats;
  }
  displayDc(dc: number | undefined) { return dc != null && Number.isFinite(dc) ? dc : '—'; }
  typeOf(feature: FeatureEntryFull): FeatureType {
    if (feature.featEntity || feature.featureType === 'FEAT') return 'FEAT';
    if (feature.optionalFeatureEntity || feature.featureType === 'OPTIONAL_FEATURE') return 'OPTIONAL_FEATURE';
    return 'CLASS_FEATURE';
  }
  get selected() {
    return (this.sheet().features ?? []).filter(feature => this.typeOf(feature) === this.selectedType
      && (this.sourceFilter === 'ALL' || (feature.featureSourceName ?? '') === this.sourceFilter));
  }
  entries(feature: FeatureEntryFull): Entry[] { return feature.featureEntity?.entries ?? feature.featEntity?.entries ?? feature.optionalFeatureEntity?.entries ?? []; }
  qualifier(record: ContentRecord): string {
    return [record.data['className'], record.data['subclassShortName'], record.data['level'] != null ? `Level ${record.data['level']}` : '', record.publication].filter(Boolean).join(' · ');
  }
  change() { this.edited.emit(); }
  toggle(feature: FeatureEntryFull) { this.expanded.has(feature) ? this.expanded.delete(feature) : this.expanded.add(feature); }
  async ngOnInit() { await this.refreshContent(); }
  ngOnDestroy() { clearTimeout(this.searchTimer); this.request++; }
  async refreshContent() {
    const request = ++this.request;
    try {
      const source = await this.cache.savedSource('development-local');
      const revision = source ? await this.cache.active('development-local', source)
        : (await this.cache.revisions('development-local')).find(row => row.active && row.revision.status === 'ready')?.revision;
      if (request !== this.request) return;
      this.revision.set(revision ?? null);
      if (!revision) { this.results.set([]); this.total.set(0); this.loading.set(false); this.message.set('Import content to browse features. Selected features, notes and uses remain editable.'); return; }
      this.offset = 0; await this.searchContent();
    } catch (error) { if (request === this.request) this.message.set(String(error)); }
  }
  setType(type: FeatureType) { clearTimeout(this.searchTimer); this.selectedType = type; this.offset = 0; this.search = ''; this.results.set([]); this.total.set(0); void this.searchContent(); }
  searchChanged() { clearTimeout(this.searchTimer); this.offset = 0; this.request++; this.results.set([]); this.searchTimer = setTimeout(() => void this.searchContent(), 200); }
  async searchContent() {
    const revision = this.revision(); if (!revision) return;
    const request = ++this.request; this.loading.set(true);
    try {
      const kinds = this.types.find(type => type.value === this.selectedType)!.kinds;
      const page = await this.cache.searchCategory(revision.id, kinds, this.search, this.offset, this.pageSize);
      if (request !== this.request) return;
      this.results.set(page.records); this.total.set(page.total); this.message.set('');
    } catch (error) { if (request === this.request) this.message.set(String(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }
  nextPage(direction: number) { this.offset = Math.max(0, this.offset + direction * this.pageSize); void this.searchContent(); }
  isSelected(record: ContentRecord) {
    const source = this.targetSource;
    return (this.sheet().features ?? []).some(feature => {
      if (feature.featureSourceName !== source) return false;
      if (feature.contentReference) return feature.contentReference.key === record.key;
      const snapshot = record.kind === 'feat' ? feature.featEntity : record.kind === 'optionalfeature' ? feature.optionalFeatureEntity : feature.featureEntity;
      return !!snapshot && entityKey(record.kind, snapshot as unknown as JsonObject) === record.key;
    });
  }
  add(record: ContentRecord) {
    if (!this.types.find(type => type.value === this.selectedType)!.kinds.includes(record.kind)) return;
    const revision = this.revision(); if (!revision || this.isSelected(record)) return;
    const feature: FeatureEntryFull = { editorId: crypto.randomUUID(), name: record.name, source: record.publication,
      featureType: this.selectedType, featureSourceName: this.targetSource, userAdded: true,
      uses: [], notes: [], contentReference: { key: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit } };
    const snapshot = structuredClone(record.data);
    if (this.selectedType === 'FEAT') feature.featEntity = snapshot as unknown as FeatEntity;
    else if (this.selectedType === 'OPTIONAL_FEATURE') feature.optionalFeatureEntity = snapshot as unknown as OptionalFeatureEntity;
    else feature.featureEntity = snapshot as unknown as FeatureEntity;
    (this.sheet().features ??= []).push(feature); this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    const data = { name, source: 'Custom', entries: this.customDescription ? [{ text: this.customDescription }] : [] };
    const feature: FeatureEntryFull = { editorId: crypto.randomUUID(), name, source: 'Custom', featureType: this.selectedType,
      featureSourceName: this.targetSource, userAdded: true, notes: [], uses: [] };
    if (this.selectedType === 'FEAT') feature.featEntity = data;
    else if (this.selectedType === 'OPTIONAL_FEATURE') feature.optionalFeatureEntity = { ...data, featureType: [] };
    else feature.featureEntity = { ...data, level: 0, className: '', classSource: '' };
    (this.sheet().features ??= []).push(feature); this.expanded.add(feature);
    this.customName = ''; this.customDescription = ''; this.change();
  }
  remove(feature: FeatureEntryFull) {
    if (((feature.notes?.length ?? 0) || (feature.uses?.length ?? 0)) && !confirm(`Remove ${feature.name} and its notes/use settings?`)) return;
    this.sheet().features!.splice(this.sheet().features!.indexOf(feature), 1); this.expanded.delete(feature); this.change();
  }

}
