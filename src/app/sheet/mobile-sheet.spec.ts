import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterData } from '../models/character.model';
import { BasicCombatActionsComponent } from './basic-combat-actions.component';
import { SwipePagesDirective } from './swipe-pages.directive';
import { applyHealthAdjustment } from './sheet-health';

@Component({
  imports: [SwipePagesDirective, BasicCombatActionsComponent],
  template: `<div appSwipePages [swipePrevious]="previous" [swipeNext]="next" (pageSwipe)="page = page + $event"><p>Page {{page}}</p><div data-horizontal-row><span>Slots</span></div><input /><button>Action</button><app-basic-combat-actions [actions]="[]" /><details><summary>Other Section</summary></details><dialog><span>Detail text</span></dialog></div>`,
})
class SwipeHost { page = 0; previous = true; next = true; }

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
      const event = new Event(type, { bubbles: true });
      const points = [{ clientX: x, clientY: y }];
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : multiple ? [...points, ...points] : points },
        changedTouches: { value: points },
      });
      target.dispatchEvent(event);
    };
    return { fixture, pages, touch, content: fixture.nativeElement.querySelector('p') as HTMLElement };
  }

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

  it('leaves horizontal rows and interactive controls to their native interactions', () => {
    const { fixture, pages, touch } = setup();
    for (const selector of ['[data-horizontal-row] span', 'input', 'button', 'dialog span']) {
      const target = fixture.nativeElement.querySelector(selector);
      touch(target, 'touchstart', 280, 200); touch(target, 'touchend', 100, 200);
    }
    expect(pages).toEqual([]);
  });

  it('allows combat-card swipes without activating the card and preserves ordinary taps', () => {
    const { fixture, pages, touch } = setup();
    const card = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    card.setAttribute('data-page-swipe', '');
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

  it('distinguishes Basic header taps from swipes, including short drags, without enabling other summaries', () => {
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
    expect(pages).toEqual([1]);
  });

  it('rejects vertical scrolling, short gestures, screen edges, and multitouch', () => {
    const { content, pages, touch } = setup();
    touch(content, 'touchstart', 280, 100); touch(content, 'touchmove', 260, 160); touch(content, 'touchend', 100, 160);
    touch(content, 'touchstart', 280, 100); touch(content, 'touchend', 240, 100);
    touch(content, 'touchstart', 10, 100); touch(content, 'touchend', 200, 100);
    touch(content, 'touchstart', 280, 100, true); touch(content, 'touchend', 100, 100);
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
