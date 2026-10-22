import { BasicInfoEditorComponent } from './basic-info-editor.component';
import { BasicInfoEditorModel } from './basic-info-editor-model';
import { AbilityScoresEditorComponent } from './ability-scores-editor.component';
import { AbilityScoresEditorModel } from './ability-scores-editor-model';
import { ProficienciesEditorComponent } from './proficiencies-editor.component';
import { ProficienciesEditorModel } from './proficiencies-editor-model';
import { CombatEditorComponent } from './combat-editor.component';
import { UiIconComponent } from '../ui-icon.component';
import { characterDescription } from '../character-description';
import { ScrollToTopComponent } from '../scroll-to-top.component';
import { CharacterUpdateNoticeComponent } from '../characters/character-update-notice.component';
import { ThemePickerComponent } from '../theme-picker.component';
import { ScrollableTabsDirective } from '../scrollable-tabs.directive';
import { SwipePagesDirective } from '../sheet/swipe-pages.directive';
import { AppDialogService } from '../services/app-dialog.service';
import { MonstersEditorComponent } from './monsters-editor.component';
import { ItemsEditorComponent } from './items-editor.component';
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExportedCharacter } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { canonicalDocument } from '../rules/canonical-document';
import { CharacterRecord } from '../characters/character-repository';
import { CharacterLibraryService } from '../characters/character-library.service';
import { DEFENSE_ABILITIES, emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { SpellSlotsComponent } from './spell-slots.component';
import { FeaturesEditorComponent } from './features-editor.component';
import { SpellsEditorComponent } from './spells-editor.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { ClassWizardComponent } from './class-wizard.component';
import { SpeciesEditorComponent } from './species-editor.component';
import { IndexedDbContentCache } from '../content/content-cache';
import { requiresContentReimport } from '../content/content-compatibility';
import { activeContentRevision } from './active-content-revision';
import { refreshCharacterDescriptions } from './refresh-character-content';
import { portableCharacter } from '../characters/portable-character';
import { defaultWalkingSpeed, primaryWalkingSpeed } from '../models/character-speed';

@Component({
  selector: 'app-local-editor',
  imports: [ScrollToTopComponent, SwipePagesDirective, CombatEditorComponent, CharacterUpdateNoticeComponent, UiIconComponent, ThemePickerComponent, ScrollableTabsDirective, FormsModule, RouterLink, BasicInfoEditorComponent, AbilityScoresEditorComponent, ProficienciesEditorComponent, OtherProficienciesComponent, SpellSlotsComponent, FeaturesEditorComponent, SpellsEditorComponent, SourceBookFilterComponent, ClassWizardComponent, SpeciesEditorComponent, ItemsEditorComponent, MonstersEditorComponent],
  templateUrl: './local-editor.component.html',
  styleUrl: './editor.css',
})
export class LocalEditorComponent implements OnInit {
  private readonly dialogs = inject(AppDialogService);
  private readonly view = inject(ChangeDetectorRef);
  private readonly library = inject(CharacterLibraryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly helpers = inject(CharacterHelpersService);
  // Models live with the shell so unfinished inputs survive page switches.
  private readonly formContext = {
    sheet: () => this.sheet,
    changed: () => this.changed(),
    reportError: (message: string) => this.error.set(message),
  };
  readonly basicInfo = new BasicInfoEditorModel(this.formContext, this.helpers, this.dialogs);
  readonly abilities = new AbilityScoresEditorModel(this.formContext, this.helpers);
  readonly proficiencies = new ProficienciesEditorModel(this.formContext, this.helpers);
  readonly busy = signal(false);
  readonly refreshingDescriptions = signal(false);
  readonly descriptionRefreshSkipped = signal<{ name: string; reason: string }[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly pages = ['Basic Info', 'Ability Scores', 'Proficiencies & More', 'Feature Sources', 'Species & Features', 'Spells', 'Items', 'Companions', 'Combat'];
  get hasCastingSources() { return this.character.featureSources?.some(source => source.isSpellcastingSource && source.name?.trim()) ?? false; }
  get hasSpellSlots() { return Object.values(this.character.spellSlots ?? {}).some(slots => slots.length > 0); }
  page = 0;
  sheet = emptyBasicCharacter();
  version = 0;
  wizardOpen = false;
  applyWizard(sheet: ExportedCharacter) {
    this.sheet = sheet; this.wizardOpen = false; this.changed();
    this.message.set('Wizard prefill applied. Review your character and save when ready.');
  }
  private savedState = canonicalDocument(this.sheet);

  get character() { return this.sheet.character!; }
  setPage(page: number) {
    if (this.busy() || page < 0 || page >= this.pages.length) return;
    this.page = page;
    this.view.markForCheck();
    this.message.set(''); this.error.set('');
  }
  private normalizeAbilities() {
    this.character.abilityScores ??= {};
    for (const ability of DEFENSE_ABILITIES) this.character.abilityScores[ability.key] ??= 10;
  }
  get unsaved() { return canonicalDocument(this.sheet) !== this.savedState; }

  ngOnInit() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      if (data['editorCharacter']) this.open(data['editorCharacter'], true);
    });
  }

  changed() { this.character.description = characterDescription(this.sheet, true); this.view.markForCheck(); this.message.set(''); this.error.set(''); }
  canLeave() { return !this.unsaved || this.dialogs.confirm('You have unsaved changes. Leave without saving?', 'Unsaved Changes', 'Leave Without Saving'); }
  async refreshCharacter() {
    if (this.busy()) return;
    try {
      const record = await this.library.get(this.character.characterUuid!);
      if (!record) { await this.router.navigateByUrl('/'); return; }
      if (!await this.canLeave()) return;
      this.open(record, true);
    } catch (error) { this.error.set(String(error)); }
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.unsaved) { event.preventDefault(); event.returnValue = ''; }
  }

  newCharacter() {
    if (this.busy()) return;
    if (!this.canLeave()) return;
    this.sheet = emptyBasicCharacter(); this.version = 0;
    this.view.markForCheck();
    this.savedState = canonicalDocument(this.sheet);
    this.resetInputs();
  }

  open(entry: CharacterRecord, routeApproved = false) {
    if (this.busy()) return;
    if (!routeApproved && !this.canLeave()) return;
    this.sheet = portableCharacter(entry.sheet);
    this.character.level ??= 1; this.character.maxHp ??= 0; this.character.armorClass ??= 10;
    this.character.resistances ??= []; this.character.senses ??= {}; this.character.speeds ??= [];
    if (!primaryWalkingSpeed(this.character.speeds)) this.character.speeds.unshift(defaultWalkingSpeed(this.character.speeds));
    this.normalizeAbilities();
    this.version = entry.version;
    this.view.markForCheck();
    this.savedState = canonicalDocument(this.sheet);
    this.resetInputs();
    this.message.set('Character loaded.');
  }

  private resetInputs() {
    this.page = 0;
    this.basicInfo.resetInputs();
    this.error.set(''); this.message.set('');
    this.descriptionRefreshSkipped.set([]);
  }

  async refreshDescriptions() {
    if (this.busy()) return;
    this.busy.set(true); this.refreshingDescriptions.set(true);
    this.error.set(''); this.message.set('Refreshing descriptions from the installed library…');
    this.descriptionRefreshSkipped.set([]);
    const draft = this.sheet;
    try {
      const before = canonicalDocument(draft);
      const cache = new IndexedDbContentCache();
      const revision = await activeContentRevision(cache);
      if (!revision) throw new Error('Import a content library before refreshing descriptions.');
      if (requiresContentReimport(revision)) throw new Error('Reimport the content library before refreshing descriptions.');
      const result = await refreshCharacterDescriptions(draft, cache, revision);
      if (this.destroyRef.destroyed) return;
      if ((await activeContentRevision(cache))?.id !== revision.id) throw new Error('The content library changed during refresh. Try again.');
      if (this.sheet !== draft || canonicalDocument(this.sheet) !== before) throw new Error('The character changed during refresh. Try again.');
      this.sheet = result.sheet;
      this.changed();
      this.descriptionRefreshSkipped.set(result.skipped);
      this.message.set(`Refreshed ${result.refreshed} entries. ${result.skipped.length} skipped. Review the details and save your character to keep the updates.`);
    } catch (error) {
      this.message.set('');
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally { this.refreshingDescriptions.set(false); this.busy.set(false); this.view.markForCheck(); }
  }

  async save() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      this.character.description = characterDescription(this.sheet, true);
      validateBasicInfo(this.sheet);
      if (this.character.calculateAC) this.character.armorClass = this.basicInfo.calculatedAc.ac;
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

}
