import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterData } from '../models/character.model';
import { SwipePagesDirective } from './swipe-pages.directive';
import { applyHealthAdjustment } from './sheet-health';

@Component({
  imports: [SwipePagesDirective],
  template: `<div appSwipePages><p>Page content</p><div data-horizontal-row><span>Slots</span></div><input /><button>Action</button><dialog><span>Detail text</span></dialog></div>`,
})
class SwipeHost {}

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

  it('provides drag feedback and animates the page change without horizontal translation', () => {
    const { fixture, content, pages, touch } = setup();
    const animation = { cancel: vi.fn(), pause: vi.fn(), currentTime: 0 };
    const animate = vi.fn(() => animation);
    const host = content.parentElement!;
    Object.defineProperty(host, 'animate', { configurable: true, value: animate });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    touch(content, 'touchstart', 280, 200);
    touch(content, 'touchmove', 180, 205);
    expect(animation.pause).toHaveBeenCalled();
    expect(animation.currentTime).toBeGreaterThan(0);
    touch(content, 'touchend', 140, 205);
    expect(pages).toEqual([1]);
    expect(animate.mock.calls.at(-1)).toEqual([
      [{ opacity: 0.82, transform: 'scale(0.99)', transformOrigin: 'top center' }, { opacity: 1, transform: 'scale(1)', transformOrigin: 'top center' }],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ]);
    fixture.destroy();
    expect(animation.cancel).toHaveBeenCalled();
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
