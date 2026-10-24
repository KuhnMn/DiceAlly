import { SHEET_PAGES, isSheetPageVisible, sheetPageForAnchor } from '../models/sheet-pages';
import { SheetLayoutService, SHEET_BREAKPOINTS, sheetColumnCapacity } from './sheet-layout.service';
import { MobileCharacterHeaderComponent } from './mobile-character-header.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { MobileSheetStatusComponent } from './mobile-sheet-status.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';
import { MobileSheetActionsComponent } from './mobile-sheet-actions.component';
import { SwipePagesDirective } from './swipe-pages.directive';
import { UiIconComponent } from '../ui-icon.component';
import { ScrollToTopComponent } from '../scroll-to-top.component';
import { CharacterUpdateNoticeComponent } from '../characters/character-update-notice.component';
import { CharacterSessionService } from '../characters/character-session.service';
import { ThemePickerComponent } from '../theme-picker.component';
import { ScrollableTabsDirective } from '../scrollable-tabs.directive';
import { AppDialogService } from '../services/app-dialog.service';
import { Component, inject, signal, ElementRef, viewChild, OnDestroy, computed, effect, HostListener, untracked, afterNextRender, afterRenderEffect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterStore } from '../stores/character.store';
import { RestService } from '../services/rest.service';
import { UnsavedChangesGuard } from '../guards/unsaved-changes.guard';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { NotesPageComponent } from './notes-page.component';

@Component({
  selector: 'app-character-sheet',
  host: { class: 'block w-full min-w-0 max-w-full', '[attr.data-sheet-mode]': 'layout.mode()', '[class.short-tablet]': 'layout.shortTablet()' },
  imports: [ScrollToTopComponent, MobileCharacterHeaderComponent, MobileCombatPageComponent, MobileCharacterInfoPageComponent, MobileSheetStatusComponent, MobileSheetActionsComponent, SwipePagesDirective, CharacterUpdateNoticeComponent, UiIconComponent,
    ThemePickerComponent,
    ScrollableTabsDirective,
    CommonModule,
    RouterModule,
    CharacterInfoPageComponent,
    FeaturesPageComponent,
    SpellsPageComponent,
    EquipmentPageComponent,
    MonstersPageComponent,
    NotesPageComponent,
  ],
  styleUrl: './character-sheet-layout.css',
  template: `
    <main class="sheet-main max-w-[1200px] mx-auto my-2 sm:my-6 px-2 py-2 sm:p-4">
      @if (characterData()) {
        <div #navigation></div>
        <div #sheetChrome class="sheet-chrome bg-surface">
        <header class="flex items-center gap-2 min-w-0 mb-2 sm:mb-3">
          <a routerLink="/" aria-label="Back to characters"
            class="min-h-10 min-w-10 inline-flex items-center justify-center shrink-0 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
            <app-ui-icon name="left" />
          </a>
          <div class="desktop-title hidden min-w-0 sm:block">
            <h1 class="break-words text-2xl font-bold">Character Sheet</h1>
            <p class="hidden sm:block text-xs text-on-surface-variant break-words">{{ characterData()?.character?.name || 'Unnamed Character' }}</p>
          </div>
          <app-mobile-character-header class="min-w-0 flex-1" [characterData]="characterData()" />
          <app-mobile-sheet-actions [expanded]="compact()" [themeOnly]="true" />
        </header>

        <app-character-update-notice [characterId]="store.nativeCharacterId()" [characterName]="characterData()?.character?.name || 'Unnamed Character'" [loadedVersion]="session.loadedVersion()" [busy]="isSaving()" (refresh)="refreshCharacter()" />
        <!-- Desktop action bar -->
        <div class="desktop-actions hidden sm:flex sm:flex-wrap items-center gap-2 mb-4">
          <div class="flex items-center gap-1.5 min-w-0 sm:mr-auto">
            <button type="button" (click)="quickSave()" [disabled]="isSaving()"
              class="min-h-10 flex-1 sm:flex-none whitespace-nowrap rounded-lg bg-secondary-container text-on-secondary-container px-3 py-2 text-sm font-semibold disabled:opacity-50">
              <span aria-hidden="true" class="inline-block mr-1" [class.animate-spin]="isSaving()"><app-ui-icon [name]="isSaving() ? 'loader' : 'save'" /></span>
              {{ isSaving() ? 'Saving…' : hasUnsavedChanges() ? 'Save changes' : 'Saved' }}
            </button>
          </div>
          <app-theme-picker class="min-w-0 sm:order-last sm:w-44" />
          <div class="col-span-2 flex gap-2 sm:col-span-1">
            @if (creatorAvailable) {
              <button type="button" (click)="editCharacter()" [disabled]="isSaving() || isOpeningEditor()" [attr.aria-busy]="isOpeningEditor()"
                class="min-h-10 flex-1 sm:flex-none rounded-lg bg-primary-container text-on-primary-container px-3 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50"
                title="Save Changes and Open the Character Editor">
                <span aria-hidden="true" class="inline-block" [class.animate-spin]="isOpeningEditor()"><app-ui-icon [name]="isOpeningEditor() ? 'loader' : 'edit'" /></span> {{ isOpeningEditor() ? 'Opening…' : 'Edit' }}
              </button>
            }
            <button
              (click)="performShortRest()"
              class="min-h-10 flex-1 sm:flex-none px-3 py-2 bg-blue-container text-on-blue-container font-medium rounded-lg hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:brightness-95 transition-all text-sm"
              title="Rest for 1 hour - restores SHORT_REST resources"
            >
              <app-ui-icon name="campfire" /> Short Rest
            </button>
            <button
              (click)="performLongRest()"
              class="min-h-10 flex-1 sm:flex-none px-3 py-2 bg-purple-container text-on-purple-container font-medium rounded-lg hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:brightness-95 transition-all text-sm"
              title="Rest for 8 hours - restores LONG_REST resources and heals to full"
            >
              <app-ui-icon name="rest" /> Long Rest
            </button>
          </div>
        </div>

        <ng-template #restReport>
        @if (restService.report(); as report) {
          <section class="mb-1 rounded-lg bg-secondary-container text-on-secondary-container px-2 py-1 sm:mb-4 sm:p-3" role="status" aria-live="polite">
            <div class="flex items-center justify-between gap-2 sm:gap-3">
              <h2 class="font-semibold text-sm">{{ report.title }}</h2>
              <button type="button" class="rounded px-1 py-0.5 text-sm sm:px-2 sm:py-1 sm:text-base hover:bg-surface-container focus-visible:outline-2" aria-label="Dismiss rest report" (click)="restService.report.set(null)">Dismiss</button>
            </div>
            @if (report.changes.length) {
              <ul class="mt-1 list-disc pl-5 text-sm space-y-1 max-h-48 overflow-y-auto">
                @for (change of report.changes; track $index) { <li>{{ change }}</li> }
              </ul>
            } @else { <p class="text-sm mt-1">No resources needed restoring.</p> }
          </section>
        }
        </ng-template>


        @if (characterData(); as sheet) { <app-mobile-sheet-status [tablet]="layout.mode() === 'tablet'" [desktop]="!compact()" [sheet]="sheet" [openingEditor]="isOpeningEditor()" (edit)="editCharacter()" [saving]="isSaving()" [dirty]="hasUnsavedChanges()" (save)="quickSave()" (shortRest)="performShortRest()" (longRest)="performLongRest()" /> }
        <ng-container [ngTemplateOutlet]="restReport" />
        </div>
        <div #pageNavigation class="sheet-tabs bg-surface pt-2 sm:pt-0">
          <nav [appScrollableTabs]="currentPage()" [sheetTabs]="true" class="justify-between mb-3 sm:mb-6 items-stretch" aria-label="Character sheet pages">
            @for (page of pages(); track page.id) {
              <button type="button" (click)="switchPage(page.id)" [attr.aria-current]="currentPage() === page.id ? 'page' : null"
                class="px-6 py-3 font-semibold transition-colors flex-auto border-b-4"
                [class.border-transparent]="currentPage() !== page.id" [class.border-primary]="currentPage() === page.id" [class.text-primary]="currentPage() === page.id" [class.text-on-surface-variant]="currentPage() !== page.id">
                {{ page.label }}
              </button>
            }
          </nav>
        </div>
        <div #tabContent tabindex="-1" role="region" aria-label="Current character sheet tab" appSwipePages [swipeMaxWidth]="breakpoints.desktop" [swipePrevious]="currentPage() !== pages()[0].id" [swipeNext]="currentPage() !== pages()[pages().length - 1].id" (pageSwipe)="swipePage($event)" class="sheet-tab-content min-w-0">
          <app-scroll-to-top [target]="tabContent" [navigation]="pageNavigation" [page]="currentPage()" />
          @if (visitedPages().has(1)) {
            <div [class.hidden]="currentPage() !== 1">
              @if (compactOverviewVisited()) {
                <div [class.hidden]="overviewDesktop()"><app-mobile-character-info-page [wideLayout]="layout.wideTablet() && layout.contentColumns() >= 2" [characterData]="characterData()" (navigateToFeatures)="navigateToFeatures($event)" (inspirationChanged)="onInspirationChanged($event)" (characterRested)="onCharacterRested($event)" /></div>
              }
              @if (desktopOverviewVisited()) {
                <div [class.hidden]="!overviewDesktop()"><app-character-info-page [characterData]="characterData()" (navigateToFeatures)="navigateToFeatures($event)" (inspirationChanged)="onInspirationChanged($event)" (characterRested)="onCharacterRested($event)" /></div>
              }
            </div>
          }
          @if (visitedPages().has(7) && isPageVisible(7)) { <div [class.hidden]="currentPage() !== 7"><app-mobile-combat-page [characterData]="characterData()" (navigateToFeatures)="navigateToFeatures($event)" /></div> }
          @if (visitedPages().has(2)) { <div [class.hidden]="currentPage() !== 2"><app-features-page [characterData]="characterData()" /></div> }
          @if (visitedPages().has(3) && isPageVisible(3)) { <div [class.hidden]="currentPage() !== 3"><app-spells-page [characterData]="characterData()" /></div> }
          @if (visitedPages().has(4) && isPageVisible(4)) { <div [class.hidden]="currentPage() !== 4"><app-equipment-page [characterData]="characterData()" /></div> }
          @if (visitedPages().has(5) && isPageVisible(5)) { <div [class.hidden]="currentPage() !== 5"><app-monsters-page [characterData]="characterData()" /></div> }
          @if (visitedPages().has(6) && isPageVisible(6)) { <div [class.hidden]="currentPage() !== 6"><app-notes-page [characterData]="characterData()" /></div> }
        </div>
      } @else {
        <p>
          No character loaded. Use the
          <a [routerLink]="['/']" class="text-primary underline">import page</a>.
        </p>
      }

    </main>
  `,
})
export class CharacterSheetComponent implements OnDestroy {
  readonly layout = inject(SheetLayoutService);
  readonly breakpoints = SHEET_BREAKPOINTS;
  readonly compact = this.layout.compact;
  readonly overviewDesktop = signal(false);
  readonly compactOverviewVisited = signal(false);
  readonly desktopOverviewVisited = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly content = viewChild<ElementRef<HTMLElement>>('tabContent');
  private readonly chrome = viewChild<ElementRef<HTMLElement>>('sheetChrome');
  private readonly destroyRef = inject(DestroyRef);
  private syncOverview() {
    const desktop = !this.compact();
    // Keep an overview's modal and its Angular view alive until the user closes it.
    if (desktop !== this.overviewDesktop() && this.element.nativeElement.querySelector('dialog[open], [aria-modal="true"]')) return;
    this.overviewDesktop.set(desktop);
    (desktop ? this.desktopOverviewVisited : this.compactOverviewVisited).set(true);
  }
  private readonly dialogs = inject(AppDialogService);
  protected store = inject(CharacterStore);
  readonly session = inject(CharacterSessionService);
  async refreshCharacter() {
    if (this.isSaving()) return;
    const id = this.store.nativeCharacterId();
    if (!id) return;
    if (this.unsavedChangesGuard.hasUnsavedChanges(this.characterData()) &&
        !await this.dialogs.confirm('Refreshing replaces your open sheet with the saved version. Unsaved changes will be lost.', 'Updated Version Available', 'Refresh Now')) return;
    try {
      if (!await this.library.get(id)) { await this.router.navigateByUrl('/'); return; }
      await this.session.open(id);
    } catch (error) { await this.dialogs.alert(String(error)); }
  }
  private library = inject(CharacterLibraryService);
  private router = inject(Router);
  readonly creatorAvailable = true;
  private fallbackVersion?: Promise<number>;
  protected restService = inject(RestService);
  private unsavedChangesGuard = inject(UnsavedChangesGuard);

  characterData = this.store.characterData;
  currentPage = signal(1);
  readonly pages = computed(() => SHEET_PAGES.filter(page => this.isPageVisible(page.id)));
  isPageVisible(id: number) { return isSheetPageVisible(this.characterData(), id); }
  swipePage(direction: number) {
    const index = this.pages().findIndex(page => page.id === this.currentPage());
    const target = this.pages()[index + direction];
    if (target) this.switchPage(target.id);
  }
  readonly visitedPages = signal(new Set([1]));
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');
  private previousMode = this.layout.mode();
  private readonly pageScroll = new Map<string, number>();
  private scrollKey(page: number) { return `${this.layout.mode()}:${page}`; }
  private scrollFrame = 0;
  hasUnsavedChanges() { return this.unsavedChangesGuard.hasUnsavedChanges(this.characterData()); }
  switchPage(page: number, restoreScroll = true) {
    if (!this.pages().some(entry => entry.id === page) || page === this.currentPage()) return;
    if (typeof window !== 'undefined') {
      if (this.compact()) this.pageScroll.set(this.scrollKey(this.currentPage()), window.scrollY);
      cancelAnimationFrame(this.scrollFrame);
    }
    this.visitedPages.update(pages => new Set([...pages, page]));
    this.currentPage.set(page);
    if (restoreScroll && typeof window !== 'undefined') {
      this.scrollFrame = requestAnimationFrame(() => {
        const navigation = this.navigation()?.nativeElement;
        const tabTop = navigation ? navigation.getBoundingClientRect().top + window.scrollY : 0;
        const top = this.compact() ? this.pageScroll.get(this.scrollKey(page)) ?? tabTop : 0;
        window.scrollTo({ top, behavior: 'instant' });
      });
    }
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }
  ngOnDestroy() { this.store.noteDraft.set(null); if (typeof window !== 'undefined') cancelAnimationFrame(this.scrollFrame); }
  isSaving = signal(false);
  readonly isOpeningEditor = signal(false);
  saveStatus = signal(false);

  constructor() {
    effect(() => {
      if (!this.pages().some(page => page.id === this.currentPage())) this.switchPage(1, false);
    });
    effect(() => { this.compact(); this.syncOverview(); });
    effect(() => {
      const mode = this.layout.mode();
      const page = untracked(() => this.currentPage());
      if (mode !== this.previousMode && typeof window !== 'undefined') {
        this.pageScroll.set(`${this.previousMode}:${page}`, window.scrollY);
        const top = this.pageScroll.get(`${mode}:${page}`);
        if (top !== undefined && !this.element.nativeElement.querySelector('dialog[open], [aria-modal="true"]')) {
          cancelAnimationFrame(this.scrollFrame);
          this.scrollFrame = requestAnimationFrame(() => {
            if (this.currentPage() === page && this.layout.mode() === mode) window.scrollTo({ top, behavior: 'instant' });
          });
        }
      }
      this.previousMode = mode;
    });
    afterRenderEffect(onCleanup => {
      const chrome = this.chrome()?.nativeElement;
      if (!chrome || typeof ResizeObserver === 'undefined') return;
      const measure = () => this.element.nativeElement.style.setProperty('--sheet-chrome-height', `${chrome.getBoundingClientRect().height}px`);
      const observer = new ResizeObserver(measure);
      observer.observe(chrome); measure();
      onCleanup(() => observer.disconnect());
    });
    afterRenderEffect(onCleanup => {
      const content = this.content()?.nativeElement;
      if (!content || typeof ResizeObserver === 'undefined') return;
      const measure = () => this.layout.contentColumns.set(sheetColumnCapacity(content.getBoundingClientRect().width));
      const observer = new ResizeObserver(measure);
      observer.observe(content); measure();
      onCleanup(() => observer.disconnect());
    });
    afterNextRender(() => {
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(() => this.syncOverview());
        observer.observe(this.element.nativeElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    this.restService.report.set(null);
    // Track the initial state as "saved"
    const initialData = this.characterData();
    if (initialData && !this.store.nativeSave && initialData.character?.characterUuid) {
      // Capture the loaded revision before the user edits, rather than accepting a newer version at save time.
      this.fallbackVersion = this.library.get(initialData.character.characterUuid).then(record => record?.version ?? 0);
    }
    if (initialData) {
      this.unsavedChangesGuard.setLastSavedState(initialData);
    }
  }

  navigateToFeatures(targetId: string) {
    const page = sheetPageForAnchor(targetId);
    if (!this.isPageVisible(page)) return;
    this.store.setFeatureScrollTarget(targetId);
    this.switchPage(page, false);
  }

  onInspirationChanged(newValue: boolean) {
    const character = this.characterData();
    if (character?.character) {
      character.character.hasInspiration = newValue;
      // Trigger a save update for the changed value
      // The component will detect changes on next save
    }
  }

  onCharacterRested(restType: 'short' | 'long') { return this.confirmRest(restType); }

  async editCharacter() {
    if (this.isSaving() || this.isOpeningEditor() || !this.characterData()) return;
    this.isOpeningEditor.set(true);
    try {
      await this.quickSave();
      const id = this.store.nativeCharacterId() ?? this.characterData()?.character?.characterUuid;
      if (this.saveStatus() && id) await this.router.navigate(['/characters', id, 'edit']);
    } finally {
      this.isOpeningEditor.set(false);
    }
  }

  async quickSave(): Promise<void> {
    if (this.isSaving()) return;
    this.store.applyNoteDraft();
    const data = this.characterData();
    if (!data || this.isSaving()) return;
    const character = structuredClone(data);
    this.isSaving.set(true);
    this.saveStatus.set(false);
    try {
      if (this.store.nativeSave) {
        await this.store.nativeSave(character);
      } else {
        // Sheets opened in memory also write to the shared library.
        const id = character.character?.characterUuid;
        if (!id) throw new Error('Character ID is missing.');
        this.fallbackVersion ??= this.library.get(id).then(record => record?.version ?? 0);
        const version = await this.library.save(character, await this.fallbackVersion);
        this.fallbackVersion = Promise.resolve(version);
      }
      this.unsavedChangesGuard.setLastSavedState(character);
      this.saveStatus.set(true);
    } catch (error) { void this.dialogs.alert('Save failed: ' + String(error)); }
    finally { this.isSaving.set(false); }
  }

  performShortRest() { return this.confirmRest('short'); }
  performLongRest() { return this.confirmRest('long'); }
  private restPending = false;
  private async confirmRest(type: 'short' | 'long') {
    const character = this.characterData();
    if (!character || this.restPending) return;
    this.restPending = true;
    try {
      const before = JSON.stringify(character);
      const changes = this.restService.previewRest(character, type);
      const policy = type === 'long'
        ? 'Current recovery policy: restore all spent Hit Dice, heal to maximum HP, clear temporary HP, and recover eligible resources.'
        : 'Current recovery policy: recover resources marked for a short rest. HP and Hit Dice are adjusted manually.';
      const accepted = await this.dialogs.confirm(policy + '\n\n' + (changes.join('\n') || 'No resources need restoring.'),
        type === 'long' ? 'Preview Long Rest' : 'Preview Short Rest', 'Apply Rest');
      if (!accepted) return;
      if (this.characterData() !== character || JSON.stringify(character) !== before) {
        await this.dialogs.alert('The character changed while the preview was open. Open the rest preview again.');
        return;
      }
      if (type === 'long') this.restService.performLongRest(character);
      else this.restService.performShortRest(character);
      this.store.setCharacter(structuredClone(character));
    } finally { this.restPending = false; }
  }
}
