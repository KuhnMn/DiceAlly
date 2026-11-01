import { afterNextRender, Component, effect, ElementRef, inject, Injector, input, OnDestroy, output, signal, TemplateRef, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DialogScrollLockService } from '../editor/dialog-scroll-lock.service';
import { UiIconComponent } from '../ui-icon.component';
import { ContentReference } from '../models/character.model';
import { ContentRecord } from '../content/content.model';
import { CompendiumDetailsComponent } from '../compendium/compendium-details.component';
import { RelatedEntriesListComponent } from '../compendium/related-entries-list.component';
import { ViewerRelatedEntries, ViewerRelatedEntriesService } from './viewer-related-entries.service';

let nextDialogId = 0;

/** Native modal supplies focus containment, Escape dismissal and an inert background. */
@Component({
  selector: 'app-sheet-detail-dialog',
  imports: [UiIconComponent, NgTemplateOutlet, RelatedEntriesListComponent, CompendiumDetailsComponent],
  template: `
    <dialog #dialog (close)="dismiss()" (click)="backdrop($event)" (keydown.escape)="$event.stopPropagation()" [attr.aria-labelledby]="titleId"
      class="fixed inset-0 m-auto box-border max-h-[92dvh] w-[calc(100vw_-_1rem)] min-w-0 max-w-[min(48rem,calc(100vw_-_1rem))] overflow-hidden whitespace-normal rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-xl open:flex open:flex-col backdrop:bg-black/60">
      <header class="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2 sm:px-6">
        @if (selected() || backLabel()) {
          <button type="button" (click)="goBack()" [attr.aria-label]="selected() ? 'Back to previous entry' : backLabel()" [title]="selected() ? 'Back to previous entry' : backLabel()" class="page-back-button"><app-ui-icon name="left" /></button>
        }
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 #heading tabindex="-1" [id]="titleId" class="min-w-0 text-xl font-bold [overflow-wrap:anywhere]">{{ selected()?.record?.name ?? title() }}</h2>
          @if (!selected() && tags()) {
            <div class="hidden flex-wrap items-center gap-2 md:flex"><ng-container [ngTemplateOutlet]="tags()" /></div>
          }
        </div>
        <button type="button" autofocus (click)="dialog.close()" aria-label="Close details" class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container"><app-ui-icon name="close" /></button>
      </header>
      <div #content class="min-h-0 min-w-0 flex-1 space-y-4 overflow-auto overscroll-contain p-4 [overflow-wrap:anywhere] [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto sm:p-6">
        <div [hidden]="!!selected()" class="space-y-4">
        @if (tags()) {
          <div class="flex flex-wrap items-center gap-2 md:hidden"><ng-container [ngTemplateOutlet]="tags()" /></div>
        }
        <ng-content />
        <app-related-entries-list [entries]="library()?.related ?? []" (opened)="openRelated($event)" />
        </div>
        @defer (when selected()) {
          @if (selected(); as entry) {
            <app-compendium-details [record]="entry.record" [revision]="entry.revision" [related]="entry.related" (opened)="openRelated($event)" />
          }
        }
      </div>
    </dialog>
  `,
})
export class SheetDetailDialogComponent implements OnDestroy {
  readonly titleId = `sheet-detail-title-${nextDialogId++}`;
  readonly title = input.required<string>();
  readonly reference = input<ContentReference>();
  readonly library = signal<ViewerRelatedEntries | null>(null);
  readonly selected = signal<ViewerRelatedEntries | null>(null);
  private readonly relatedEntries = inject(ViewerRelatedEntriesService);
  private readonly history: ViewerRelatedEntries[] = [];
  private readonly scrollPositions: number[] = [];
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly injector = inject(Injector);
  private request = 0;
  readonly backLabel = input('');
  readonly back = output<void>();
  readonly tags = input<TemplateRef<unknown> | null>(null);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly lock = inject(DialogScrollLockService);
  private opener: HTMLElement | null = null;
  private locked = false;
  constructor() {
    effect(() => {
      const reference = this.reference();
      const request = ++this.request;
      this.library.set(null);
      this.selected.set(null);
      this.history.length = 0;
      this.scrollPositions.length = 0;
      if (reference) {
        void this.relatedEntries.load(reference, () => request === this.request).then(value => {
          if (request === this.request) this.library.set(value);
        }).catch(() => { /* Library enrichment is optional; the saved detail stays available. */ });
      }
    });
    afterNextRender(() => {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.lock.lock();
      this.locked = true;
    });
  }
  openRelated(record: ContentRecord) {
    const current = this.selected();
    const context = current ?? this.library();
    if (!context) return;
    if (current) this.history.push(current);
    this.scrollPositions.push(this.content().nativeElement.scrollTop);
    const request = ++this.request;
    this.selected.set({ record, revision: context.revision, related: [] });
    this.positionDetails(0);
    void this.relatedEntries.open(record, context.revision, () => request === this.request).then(value => {
      if (request === this.request) this.selected.set(value);
    }).catch(() => { /* Keep the selected local record readable when a linked record is unavailable. */ });
  }
  goBack() {
    if (!this.selected()) { this.back.emit(); return; }
    ++this.request;
    this.selected.set(this.history.pop() ?? null);
    this.positionDetails(this.scrollPositions.pop() ?? 0);
  }
  private positionDetails(top: number) {
    afterNextRender(() => {
      this.content().nativeElement.scrollTop = top;
      this.heading().nativeElement.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
  dismiss() { this.release(); this.closed.emit(); }
  backdrop(event: MouseEvent) {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
  private release() {
    if (this.locked) { this.lock.unlock(); this.locked = false; }
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.opener = null;
  }
  ngOnDestroy() { ++this.request; this.release(); }
}
