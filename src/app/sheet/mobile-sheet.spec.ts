import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterData } from '../models/character.model';
import { BasicCombatActionsComponent } from './basic-combat-actions.component';
import { SwipePagesDirective } from './swipe-pages.directive';
import { applyHealthAdjustment } from './sheet-health';
import { captureSwipePane } from './swipe-snapshot';

@Component({
  imports: [SwipePagesDirective, BasicCombatActionsComponent],
  template: `<div appSwipePages [swipeMaxWidth]="maxWidth" [swipePrevious]="previous" [swipeNext]="next" (pageSwipe)="page = page + $event"><p>Page {{page}}</p><div data-horizontal-row><span>Slots</span></div><input /><label class="search-label"><span>Search</span><input type="search" /></label><label class="number-label"><span>Value</span><input type="number" /></label><label class="range-label"><span>Range</span><input type="range" /></label><input type="date" /><div contenteditable="true">Editable</div><textarea></textarea><select><option>Choice</option></select><label class="toggle-label"><input type="checkbox" /><span>Checkbox</span></label><input type="radio" /><button>Action</button><a href="#destination"><span>Linked entry</span></a><svg><path d="M0 0h10" /></svg><app-basic-combat-actions [actions]="[]" /><details><summary>Other Section</summary></details><dialog><span>Detail text</span></dialog></div>`,
})
class SwipeHost { maxWidth = 640; page = 0; previous = true; next = true; }

describe('Mobile page swipes', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function setup() {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    const fixture = TestBed.createComponent(SwipeHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.query(By.directive(SwipePagesDirective)).injector.get(SwipePagesDirective);
    const pages: number[] = [];
    directive.pageSwipe.subscribe(page => pages.push(page));
    const touch = (target: HTMLElement, type: string, x: number, y: number, multiple = false) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const points = [{ clientX: x, clientY: y }];
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : multiple ? [...points, ...points] : points },
        changedTouches: { value: points },
      });
      target.dispatchEvent(event);
      return event;
    };
    return { fixture, pages, touch, content: fixture.nativeElement.querySelector('p') as HTMLElement };
  }

  it('supports tablet touch swipes when enabled by the sheet while leaving the desktop boundary unchanged', () => {
    const { fixture, content, pages, touch } = setup();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(820);
    touch(content, 'touchstart', 280, 200); touch(content, 'touchend', 100, 200);
    expect(pages).toEqual([]);
    fixture.componentInstance.maxWidth = 1280; fixture.detectChanges();
    touch(content, 'touchstart', 280, 200); touch(content, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
    touch(content, 'touchstart', 280, 200); touch(content, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
  });

  it('recognizes deliberate left and right gestures', () => {
    const { content, pages, touch } = setup();
    touch(content, 'touchstart', 280, 200); touch(content, 'touchend', 140, 205);
    touch(content, 'touchstart', 120, 200); touch(content, 'touchend', 260, 205);
    expect(pages).toEqual([1, -1]);
  });

  it('follows the finger, slides the actual next page in, and cleans up inert snapshots', async () => {
    const { fixture, content, pages, touch } = setup();
    const host = content.parentElement!;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ left: 8, top: 100, bottom: 800, width: 374, height: 700 } as DOMRect);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    try {
      touch(content, 'touchstart', 280, 200);
      touch(content, 'touchmove', 180, 205);
      const outgoing = document.querySelector('[data-swipe-snapshot]') as HTMLElement;
      expect(outgoing.inert).toBe(true);
      expect(outgoing.getAttribute('aria-hidden')).toBe('true');
      expect((outgoing.firstElementChild as HTMLElement).style.transform).toBe('translate3d(-100px, 0, 0)');
      expect(host.style.opacity).toBe('0');
      expect(pages).toEqual([]);
      touch(content, 'touchend', 140, 205);
      expect(pages).toEqual([1]);
      expect(fixture.componentInstance.page).toBe(1);
      frames.at(-1)!(0);
      const snapshots = document.querySelectorAll('[data-swipe-snapshot]');
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].textContent).toContain('Page 0');
      expect(snapshots[1].textContent).toContain('Page 1');
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate.mock.calls[0][0]).toEqual([{ transform: 'translate3d(-100px, 0, 0)' }, { transform: 'translate3d(-374px, 0, 0)' }]);
      expect(animate.mock.calls[1][0]).toEqual([{ transform: 'translate3d(274px, 0, 0)' }, { transform: 'translate3d(0px, 0, 0)' }]);
      fixture.destroy();
      expect(document.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
      expect(host.style.opacity).toBe('');
    } finally { delete (HTMLElement.prototype as { animate?: unknown }).animate; }
  });

  it('bounces back without changing page when the gesture is short or the next tab is unavailable', () => {
    const { fixture, content, pages, touch } = setup();
    const host = content.parentElement!;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ left: 8, top: 100, bottom: 800, width: 374, height: 700 } as DOMRect);
    touch(content, 'touchstart', 280, 200); touch(content, 'touchmove', 230, 200); touch(content, 'touchend', 230, 200);
    expect(pages).toEqual([]);
    fixture.componentInstance.next = false; fixture.detectChanges();
    touch(content, 'touchstart', 280, 200); touch(content, 'touchmove', 180, 200);
    expect((document.querySelector('[data-swipe-snapshot]')!.firstElementChild as HTMLElement).style.transform).toBe('translate3d(-20px, 0, 0)');
    touch(content, 'touchend', 100, 200);
    expect(pages).toEqual([]);
    fixture.destroy();
    expect(document.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
  });

  it('clips a scrolled tab snapshot below the shared navigation rather than painting across the header', () => {
    const { content } = setup();
    vi.spyOn(content.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 8, top: -200, bottom: 900, width: 374, height: 1100 } as DOMRect);
    const picture = captureSwipePane(content.parentElement!, 280)!;
    try {
      expect(picture.viewport.style.top).toBe('280px');
      expect(picture.content.style.top).toBe('-480px');
      expect(picture.viewport.querySelector('app-scroll-to-top')).toBeNull();
    } finally { picture.viewport.remove(); }
  });

  it('switches pages without animation when reduced motion is preferred', () => {
    const { content, pages, touch } = setup();
    const animate = vi.fn();
    Object.defineProperty(content.parentElement!, 'animate', { configurable: true, value: animate });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    touch(content, 'touchstart', 280, 200);
    touch(content, 'touchmove', 180, 205);
    touch(content, 'touchend', 140, 205);
    expect(pages).toEqual([1]);
    expect(animate).not.toHaveBeenCalled();
  });

  it('leaves horizontal rows, native pickers, sliders, rich text and dialogs to their native interactions', () => {
    const { fixture, pages, touch } = setup();
    for (const selector of ['[data-horizontal-row] span', 'input[type=range]', 'input[type=date]', 'select', '.range-label span', '[contenteditable]', 'dialog span']) {
      const target = fixture.nativeElement.querySelector(selector);
      touch(target, 'touchstart', 280, 200); touch(target, 'touchend', 100, 200);
    }
    expect(pages).toEqual([]);
  });

  it('allows unmarked button swipes without activating the button and preserves ordinary taps', () => {
    const { fixture, pages, touch } = setup();
    const card = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const title = document.createElement('span');
    card.append(title);
    const clicked = vi.fn();
    card.addEventListener('click', clicked);
    touch(title, 'touchstart', 280, 200);
    touch(title, 'touchmove', 180, 205);
    touch(title, 'touchend', 140, 205);
    card.click();
    expect(pages).toEqual([1]);
    expect(clicked).not.toHaveBeenCalled();
    touch(title, 'touchstart', 180, 200);
    touch(title, 'touchend', 180, 200);
    card.click();
    expect(clicked).toHaveBeenCalledOnce();
    expect(pages).toEqual([1]);
  });

  it('starts page swipes on text/search fields, their labels and textareas without changing their values', () => {
    const { fixture, pages, touch } = setup();
    for (const selector of ['input', 'input[type=search]', '.search-label span', 'textarea']) {
      const target = fixture.nativeElement.querySelector(selector) as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.value = 'Keep this text'; target.setSelectionRange(0, 0); target.focus();
      }
      touch(target, 'touchstart', 280, 200);
      const move = touch(target, 'touchmove', 180, 210);
      expect(move.defaultPrevented).toBe(true);
      touch(target, 'touchend', 100, 230);
      expect(document.activeElement).not.toBe(target);
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) expect(target.value).toBe('Keep this text');
    }
    expect(pages).toEqual([1, 1, 1, 1]);
  });

  it('starts swipes on numeric fields and their labels while preserving values, focus on taps and vertical scrolling', () => {
    const { fixture, pages, touch } = setup();
    const field = fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement;
    field.setAttribute('role', 'spinbutton'); field.value = '42'; field.focus();
    touch(field, 'touchstart', 180, 200); touch(field, 'touchend', 180, 200);
    expect(document.activeElement).toBe(field);
    touch(field, 'touchstart', 280, 200);
    expect(touch(field, 'touchmove', 275, 250).defaultPrevented).toBe(false);
    touch(field, 'touchend', 100, 260);
    expect(pages).toEqual([]);
    for (const target of [field, fixture.nativeElement.querySelector('.number-label span')]) {
      touch(target, 'touchstart', 280, 200); touch(target, 'touchmove', 180, 210); touch(target, 'touchend', 100, 230);
    }
    expect(pages).toEqual([1, 1]); expect(field.value).toBe('42');
    expect(document.activeElement).not.toBe(field);
  });

  it.each(['input[type=checkbox]', '.toggle-label span', 'input[type=radio]'])('separates swipes from toggle taps on %s', selector => {
    const { fixture, pages, touch } = setup();
    const target = fixture.nativeElement.querySelector(selector) as HTMLElement;
    const input = (target instanceof HTMLInputElement ? target : target.parentElement!.querySelector('input')) as HTMLInputElement;
    touch(target, 'touchstart', 280, 200); touch(target, 'touchmove', 180, 210); touch(target, 'touchend', 100, 230);
    target.click();
    expect(pages).toEqual([1]); expect(input.checked).toBe(false);
    touch(target, 'touchstart', 180, 200); touch(target, 'touchend', 180, 200); target.click();
    expect(input.checked).toBe(true); expect(pages).toEqual([1]);
  });

  it('preserves text-field taps, short drags, vertical scrolling, selections and explicit exclusions', () => {
    const { fixture, pages, touch } = setup();
    const field = fixture.nativeElement.querySelector('input[type=search]') as HTMLInputElement;
    field.value = 'Keep my search'; field.setSelectionRange(0, 0); field.focus();
    touch(field, 'touchstart', 180, 200); touch(field, 'touchend', 180, 200);
    expect(document.activeElement).toBe(field);
    touch(field, 'touchstart', 280, 200); touch(field, 'touchmove', 240, 200); touch(field, 'touchend', 240, 200);
    expect(document.activeElement).toBe(field);
    touch(field, 'touchstart', 280, 200);
    expect(touch(field, 'touchmove', 275, 250).defaultPrevented).toBe(false);
    touch(field, 'touchend', 100, 260);
    field.setSelectionRange(0, 4);
    touch(field, 'touchstart', 280, 200); touch(field, 'touchend', 100, 200);
    expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe(4);
    field.setSelectionRange(0, 0); field.parentElement!.setAttribute('data-no-page-swipe', '');
    touch(field, 'touchstart', 280, 200); touch(field, 'touchend', 100, 200);
    expect(pages).toEqual([]); expect(field.value).toBe('Keep my search');
  });

  it('allows swipes on long input values while preserving native horizontal row exclusions', () => {
    const { fixture, pages, touch } = setup();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    field.value = 'A very long search query '.repeat(20); field.setSelectionRange(0, 0);
    field.style.overflowX = 'auto';
    Object.defineProperties(field, { scrollWidth: { value: 1000 }, clientWidth: { value: 200 } });
    touch(field, 'touchstart', 280, 200); touch(field, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
    fixture.nativeElement.querySelector('[data-horizontal-row]').append(field);
    touch(field, 'touchstart', 280, 200); touch(field, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
  });

  it('handles links and SVG icons while preserving taps and explicit gesture exclusions', () => {
    const { fixture, pages, touch } = setup();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const navigate = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener('click', navigate);
    const text = link.querySelector('span')!;
    touch(text, 'touchstart', 280, 200); touch(text, 'touchmove', 180, 205); touch(text, 'touchend', 100, 220); link.click();
    expect(pages).toEqual([1]); expect(navigate).not.toHaveBeenCalled();
    touch(text, 'touchstart', 180, 200); touch(text, 'touchend', 180, 200); link.click();
    expect(navigate).toHaveBeenCalledOnce();
    const icon = fixture.nativeElement.querySelector('path');
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.append(icon.parentElement);
    button.setAttribute('data-no-page-swipe', '');
    touch(icon, 'touchstart', 280, 200); touch(icon, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
    button.removeAttribute('data-no-page-swipe');
    touch(icon, 'touchstart', 280, 200); touch(icon, 'touchend', 100, 200);
    expect(pages).toEqual([1, 1]);
    button.setAttribute('data-horizontal-row', '');
    touch(icon, 'touchstart', 280, 200); touch(icon, 'touchend', 100, 200);
    expect(pages).toEqual([1, 1]);
  });

  it('allows diagonal swipes and keeps a recognized horizontal gesture through vertical drift', () => {
    const { content, pages, touch } = setup();
    touch(content, 'touchstart', 280, 100);
    touch(content, 'touchmove', 180, 160);
    touch(content, 'touchend', 100, 200);
    expect(pages).toEqual([1]);
    touch(content, 'touchstart', 100, 100);
    touch(content, 'touchmove', 135, 105);
    touch(content, 'touchmove', 200, 240);
    touch(content, 'touchend', 220, 280);
    expect(pages).toEqual([1, -1]);
  });

  it('distinguishes disclosure header taps from swipes, including short drags', () => {
    const { fixture, pages, touch } = setup();
    const header = fixture.nativeElement.querySelector('app-basic-combat-actions summary') as HTMLElement;
    const details = header.parentElement as HTMLDetailsElement;
    touch(header, 'touchstart', 180, 200); touch(header, 'touchend', 180, 200); header.click();
    expect(details.open).toBe(true); expect(pages).toEqual([]);
    touch(header, 'touchstart', 280, 200); touch(header, 'touchmove', 180, 245); touch(header, 'touchend', 100, 280); header.click();
    expect(pages).toEqual([1]); expect(details.open).toBe(true);
    touch(header, 'touchstart', 280, 200); touch(header, 'touchmove', 240, 202); touch(header, 'touchend', 240, 202); header.click();
    expect(pages).toEqual([1]); expect(details.open).toBe(true);
    touch(header, 'touchstart', 180, 200); touch(header, 'touchend', 180, 200); header.click();
    expect(details.open).toBe(false);
    const other = fixture.nativeElement.querySelector('summary:not([data-page-swipe])') as HTMLElement;
    touch(other, 'touchstart', 280, 200); touch(other, 'touchend', 100, 200);
    expect(pages).toEqual([1, 1]);
  });

  it('rejects vertical scrolling, short gestures, screen edges, and multitouch', () => {
    const { content, pages, touch } = setup();
    touch(content, 'touchstart', 280, 100); touch(content, 'touchmove', 260, 160); touch(content, 'touchend', 100, 160);
    touch(content, 'touchstart', 280, 100); touch(content, 'touchend', 240, 100);
    touch(content, 'touchstart', 10, 100); touch(content, 'touchend', 200, 100);
    touch(content, 'touchstart', 280, 100, true); touch(content, 'touchend', 100, 100);
    expect(pages).toEqual([]);
  });

  it('locks document scrolling after horizontal recognition, including vertical drift and the outgoing transition', async () => {
    const { fixture, content, pages, touch } = setup();
    vi.spyOn(content.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 8, top: 100, bottom: 800, width: 374, height: 700 } as DOMRect);
    const root = document.documentElement;
    const before = root.style.overflowY;
    touch(content, 'touchstart', 280, 200);
    expect(root.style.overflowY).toBe(before);
    touch(content, 'touchmove', 240, 205);
    expect(root.style.overflowY).toBe('hidden');
    expect(touch(content, 'touchmove', 180, 400).defaultPrevented).toBe(true);
    const outside = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside); expect(outside.defaultPrevented).toBe(true);
    touch(content, 'touchend', 100, 400);
    expect(pages).toEqual([1]); expect(root.style.overflowY).toBe('hidden');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(root.style.overflowY).toBe(before);
    const released = new Event('touchmove', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(released); expect(released.defaultPrevented).toBe(false);
    fixture.destroy();
  });

  it('releases scroll locks after cancellation, resize and destruction and restores prior inline styles', async () => {
    const { fixture, content, pages, touch } = setup();
    vi.spyOn(content.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 8, top: 100, bottom: 800, width: 374, height: 700 } as DOMRect);
    const root = document.documentElement, previous = root.getAttribute('style');
    root.style.setProperty('overflow-y', 'scroll', 'important');
    root.style.setProperty('scrollbar-gutter', 'stable both-edges', 'important');
    const priority = root.style.getPropertyPriority('overflow-y');
    try {
      for (const finish of ['cancel', 'resize', 'destroy']) {
        touch(content, 'touchstart', 280, 200); touch(content, 'touchmove', 240, 205);
        expect(root.style.overflowY).toBe('hidden');
        if (finish === 'cancel') { content.dispatchEvent(new Event('touchcancel', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 200)); }
        else if (finish === 'resize') window.dispatchEvent(new Event('resize'));
        else fixture.destroy();
        expect(root.style.overflowY).toBe('scroll');
        expect(root.style.getPropertyPriority('overflow-y')).toBe(priority);
        expect(root.style.scrollbarGutter).toBe('stable both-edges');
      }
      expect(pages).toEqual([]);
    } finally { if (previous === null) root.removeAttribute('style'); else root.setAttribute('style', previous); }
  });

  it('never locks document scrolling for an initially vertical gesture', () => {
    const { content, pages, touch } = setup();
    const before = document.documentElement.style.overflowY;
    touch(content, 'touchstart', 280, 200);
    expect(touch(content, 'touchmove', 275, 250).defaultPrevented).toBe(false);
    expect(document.documentElement.style.overflowY).toBe(before);
    touch(content, 'touchend', 100, 260);
    expect(pages).toEqual([]);
  });
});

describe('Shared sheet health adjustments', () => {
  it('absorbs damage with temporary HP before reducing current HP and clamps at zero', () => {
    const character = { currentHp: 20, maxHp: 30, tempHp: 5 } as CharacterData;
    applyHealthAdjustment(character, 'damage', 8);
    expect(character.currentHp).toBe(17);
    expect(character.tempHp).toBe(0);
    applyHealthAdjustment(character, 'damage', 100);
    expect(character.currentHp).toBe(0);
  });

  it('respects a maximum HP override and replaces temporary HP', () => {
    const character = { currentHp: 20, maxHp: 30, maxHpOverride: 25, tempHp: 5 } as CharacterData;
    applyHealthAdjustment(character, 'heal', 100);
    expect(character.currentHp).toBe(25);
    applyHealthAdjustment(character, 'temp', 3);
    expect(character.tempHp).toBe(3);
    applyHealthAdjustment(character, 'temp', 0);
    expect(character.tempHp).toBe(0);
    applyHealthAdjustment(character, 'damage', NaN);
    applyHealthAdjustment(character, 'heal', -10);
    expect(character.currentHp).toBe(25);
  });
});

describe('Compact spell duration', () => {
  it('keeps concentration and alternative durations while using readable units', () => {
    const helpers = new CharacterHelpersService();
    expect(helpers.compactSpellDurationLabel([
      { type: 'timed', duration: { amount: 10, type: 'minute' }, concentration: true },
      { type: 'timed', duration: { amount: 1, type: 'hour' } },
      { type: 'instant' }, { type: 'special' },
    ])).toBe('Up to 10 minutes or 1 hour or Instantaneous or Special');
    expect(helpers.spellDurationLabel([{ duration: { amount: 10, type: 'minute' }, concentration: true }])).toBe('Concentration, Up to 10 minutes');
  });
});
