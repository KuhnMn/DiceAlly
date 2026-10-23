import { spellRecordClasses } from '../content/spell-adapter';
import { rankSearchResults } from '../search-ranking';
import { UiIconComponent } from '../ui-icon.component';
import { InfoButtonComponent } from '../info-button.component';
import { groupWizardReview, REVIEW_ACTION_LABELS } from './wizard-review';
import { isCompleteSelection } from '../rules/spell-choice';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';
import { Component, OnDestroy, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision, normalize } from '../content/content.model';
import { ExportedCharacter } from '../models/character.model';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { WizardClass, WizardState } from './wizard-prefill';
import { WIZARD_SECTIONS, WizardChoice, matchesSubclass, previewClassWizard } from './class-wizard-preview';
import { validateBasicInfo } from './basic-info';
import { SearchableSelectComponent, SelectOption } from './searchable-select.component';
import { activeContentRevision } from './active-content-revision';

@Component({
  selector: 'app-class-wizard',
  imports: [InfoButtonComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, SourceBookFilterComponent, SearchableSelectComponent, CapitalizeFirstPipe],
  templateUrl: './class-wizard.component.html',
  styleUrls: ['./editor.css', './editor-spell-filters.css'],
})
export class ClassWizardComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly applied = output<ExportedCharacter>();
  readonly closed = output<void>();
  readonly loading = signal(true);
  readonly error = signal('');
  readonly revision = signal<ImportRevision | null>(null);
  readonly proposal = signal<ReturnType<typeof previewClassWizard> | null>(null);
  readonly reviewItems = computed(() => {
    const proposal = this.proposal();
    return proposal ? groupWizardReview(proposal.changes, this.sheet(), proposal.sheet) : [];
  });
  readonly reviewActionLabels = REVIEW_ACTION_LABELS;
  readonly sections = WIZARD_SECTIONS;
  readonly sourceBooks = inject(SourceBookFilterService);
  private readonly cache = new IndexedDbContentCache();
  readonly records = new Map<string, ContentRecord>();
  state: WizardState = { revisionId: '', classes: [], answers: {}, options: {}, baseline: [], protectedPaths: [] };
  stage = 0;
  choiceSearch: Record<string, string> = {};
  leaveManual = false;
  readonly overrideEdits: Record<string, boolean> = {};
  get overrideSections() {
    const sections = this.sections.filter(section => this.overrideEdits[section.key] && this.state.options[section.key] !== false).map(section => section.key);
    // Only override a shared source when every enabled section using it opts in.
    const sourceSections = ['features', 'spells'].filter(key => this.state.options[key] !== false);
    if (sourceSections.length && sourceSections.every(key => sections.includes(key))) sections.push('sources');
    return sections;
  }
  differentRevision = false;
  savedRevisionAvailable = false;
  private destroyed = false;
  private seededFromSheet = false;

  constructor() {
    effect(() => {
      this.sourceBooks.selected();
      untracked(() => { if (this.revision()) this.rebuild(); });
    });
  }
  async ngOnInit() {
    if (this.sheet().creatorWizard) this.state = structuredClone(this.sheet().creatorWizard!);
    await this.loadContent();
  }
  ngOnDestroy() { this.destroyed = true; }
  async loadContent(useCurrent = false) {
    this.loading.set(true); this.error.set(''); this.records.clear();
    try {
      const revisions = await this.cache.revisions('development-local');
      // The sheet holds the saved selection; state.revisionId changes when previewing another library.
      const savedRevisionId = this.sheet().creatorWizard?.revisionId;
      const saved = revisions.find(entry => entry.revision.id === savedRevisionId && entry.revision.status === 'ready')?.revision;
      this.savedRevisionAvailable = !!saved;
      const pinned = useCurrent ? undefined : saved;
      const revision = pinned ?? await activeContentRevision(this.cache);
      if (!revision) { this.error.set('Import content to use the wizard. Your current character stays editable.'); return; }
      const kinds = new Set(['class', 'subclass', 'classFeature', 'subclassFeature', 'optionalfeature', 'species', 'background', 'spell']);
      await this.cache.visit(revision.id, async record => { if (!this.destroyed && kinds.has(record.kind)) this.records.set(record.key, record); });
      const tools = await this.cache.tools(revision.id); tools.forEach(record => this.records.set(record.key, record));
      if (this.destroyed) return;
      const savedRevision = this.sheet().creatorWizard?.revisionId;
      this.differentRevision = !!savedRevision && savedRevision !== revision.id;
      this.revision.set(revision);
      this.state.revisionId = revision.id;
      if (!this.seededFromSheet) {
        this.seedFromSheet();
        this.seededFromSheet = true;
      }
      this.rebuild();
    } catch (error) { this.error.set(String(error)); }
    finally { this.loading.set(false); }
  }
  /** Opening the wizard reads the current identity without applying changes to the draft. */
  private seedFromSheet() {
    const sheet = this.sheet();
    if (sheet.classes !== undefined) {
      const saved = [...this.state.classes];
      this.state.classes = sheet.classes.filter(row => !row.custom && row.classKey).map(row => {
        const position = saved.findIndex(selection => selection.classKey === row.classKey);
        const previous = position >= 0 ? saved.splice(position, 1)[0] : undefined;
        const record = this.records.get(row.classKey!);
        return {
          ...(previous ?? {
            selectionId: crypto.randomUUID(),
            spellList: record && this.spellLists.includes(record.name) ? record.name : '',
            useSpellbook: normalize(record?.name ?? '') === 'wizard',
          }),
          classKey: row.classKey!, subclassKey: row.subclassKey, level: row.level,
        };
      });
    }
    this.state.speciesKey = sheet.species?.contentReference?.key;
    this.state.backgroundKey = sheet.background?.contentReference?.key;
    this.state.customBackgroundName = sheet.background && !this.state.backgroundKey ? sheet.background.name : undefined;
  }
  label(key: string) {
    const record = this.records.get(key);
    if (record) return `${record.name} (${record.publication})`;
    try { const parts = JSON.parse(key); return `${parts[1]} (${parts[2]}) — content unavailable`; }
    catch { return 'Content unavailable'; }
  }
  get classes() { return [...this.records.values()].filter(record => record.kind === 'class'
    && this.sourceBooks.allows(record.publication))
    .sort((a, b) => this.label(a.key).localeCompare(this.label(b.key))); }
  classOptions(selection: WizardClass) {
    const choices = this.classes;
    const selected = this.records.get(selection.classKey);
    return selected && !choices.some(record => record.key === selected.key) ? [selected, ...choices] : choices;
  }
  subclasses(selection: WizardClass) {
    return [...this.records.values()].filter(record => matchesSubclass(record, selection.classKey)
      && (record.key === selection.subclassKey || this.sourceBooks.allows(record.publication)))
      .sort((a, b) => this.label(a.key).localeCompare(this.label(b.key)));
  }
  get species() {
    return [...this.records.values()].filter(record => record.kind === 'species'
      && (record.key === this.state.speciesKey || this.sourceBooks.allows(record.publication)))
      .sort((a, b) => this.label(a.key).localeCompare(this.label(b.key)));
  }
  get spellLists() { return [...new Set([...this.records.values()].filter(record => record.kind === 'spell' && this.sourceBooks.allows(record.publication))
    .flatMap(record => spellRecordClasses(record).filter(entry => this.sourceBooks.allows(entry.source ?? record.publication)).map(entry => entry.name)))].sort(); }
  classChoices(selection: WizardClass): SelectOption[] {
    return [{ value: '', label: 'Select a class' }, ...this.classOptions(selection).map(record => ({
      value: record.key, label: this.label(record.key), disabled: this.isTaken(record.key, selection),
    }))];
  }
  subclassChoices(selection: WizardClass): SelectOption[] {
    return [{ value: '', label: 'No subclass yet' }, ...this.subclasses(selection).map(record => ({ value: record.key, label: this.label(record.key) }))];
  }
  get spellListChoices(): SelectOption[] { return [{ value: '', label: 'Do not prefill a class spell list' }, ...this.spellLists.map(name => ({ value: name, label: name }))]; }
  get speciesChoices(): SelectOption[] { return [{ value: '', label: 'Do not prefill a species' }, ...this.species.map(record => ({ value: record.key, label: this.label(record.key) }))]; }
  get backgroundChoices(): SelectOption[] {
    return [{ value: '', label: 'No background' }, { value: 'CUSTOM', label: 'Custom background' }, ...[...this.records.values()]
      .filter(record => record.kind === 'background' && (record.key === this.state.backgroundKey || this.sourceBooks.allows(record.publication)))
      .sort((a, b) => a.name.localeCompare(b.name)).map(record => ({ value: record.key, label: this.label(record.key) }))];
  }
  get backgroundChoice() { return this.state.backgroundKey ?? (this.state.customBackgroundName !== undefined ? 'CUSTOM' : ''); }
  selectBackground(key: string) {
    this.state.backgroundKey = key && key !== 'CUSTOM' ? key : undefined;
    this.state.customBackgroundName = key === 'CUSTOM' ? '' : undefined;
    this.rebuild();
  }
  isTaken(key: string, selection: WizardClass) { return this.state.classes.some(other => other !== selection && other.classKey === key); }
  addClass() { this.state.classes.push({ selectionId: crypto.randomUUID(), classKey: '', level: 1 }); this.rebuild(); }
  removeClass(position: number) { this.state.classes.splice(position, 1); this.rebuild(); }
  moveClass(position: number, direction: number) {
    const target = position + direction;
    if (target < 0 || target >= this.state.classes.length) return;
    [this.state.classes[position], this.state.classes[target]] = [this.state.classes[target], this.state.classes[position]];
    this.rebuild();
  }
  selectClass(selection: WizardClass, key: string) {
    selection.classKey = key; selection.subclassKey = undefined;
    const record = this.records.get(key);
    selection.spellList = record && this.spellLists.includes(record.name) ? record.name : '';
    selection.useSpellbook = normalize(record?.name ?? '') === 'wizard';
    this.rebuild();
  }
  rebuild() {
    const revision = this.revision(); if (!revision) return;
    try { this.proposal.set(previewClassWizard(this.sheet(), this.state, revision, this.records, this.sourceBooks.selected(), this.overrideSections)); this.error.set(''); }
    catch (error) { this.proposal.set(null); this.error.set(error instanceof Error ? error.message : String(error)); }
  }
  choiceComplete(choice: WizardChoice) {
    return isCompleteSelection(this.state.answers[choice.id] ?? [], choice.count, choice.candidates.map(candidate => candidate.value));
  }
  choices(choice: WizardChoice) {
    const query = choice.searchable === false ? '' : normalize(this.choiceSearch[choice.id] ?? '');
    return rankSearchResults(choice.candidates.filter(candidate => normalize(candidate.label).includes(query) || this.state.answers[choice.id]?.includes(candidate.value)), query, candidate => candidate.label);
  }
  friendlyMessage(message: string) {
    if (message.includes('Missing qualified feature')) return 'A selected class feature is missing from this import. Refresh your content or select another class version.';
    if (message.includes('handler') || message.includes('Unsupported') || message.includes('spell grant')) return 'An option in this content needs manual configuration after the prefill.';
    return message.replace(/\[.*$/, '').replace(/grant/gi, 'option').trim();
  }
  toggleChoice(choice: WizardChoice, value: string) {
    const current = this.state.answers[choice.id] ?? [];
    this.state.answers[choice.id] = current.includes(value) ? current.filter(entry => entry !== value)
      : choice.count === 1 ? [value] : current.length < choice.count ? [...current, value] : current;
    this.rebuild();
  }
  get canSelect() { return !!this.proposal() && !this.proposal()!.errors.length; }
  get canReview() { return this.canSelect && (this.leaveManual || (!this.proposal()!.unresolved.length && !this.proposal()!.warnings.length)); }
  advance() { this.rebuild(); if (this.stage === 0 && this.canSelect) this.stage = 1; else if (this.stage === 1 && this.canReview) this.stage = 2; }
  apply() {
    this.rebuild();
    const proposal = this.proposal(); if (this.stage !== 2 || !proposal || !this.canReview) return;
    try { validateBasicInfo(proposal.sheet); this.applied.emit(proposal.sheet); }
    catch (error) { this.error.set(String(error)); }
  }
}
