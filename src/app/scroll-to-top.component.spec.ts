import { TestBed } from '@angular/core/testing';
import { ScrollToTopComponent } from './scroll-to-top.component';

describe('Current-tab scroll to top', () => {
  const rectangle = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 320, width: 320, x: 0, y: top, toJSON() {} });
  function setup(sticky = true) {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const target = document.createElement('div'), navigation = document.createElement('nav');
    target.tabIndex = -1; document.body.append(target, navigation);
    navigation.style.position = sticky ? 'sticky' : 'static';
    let targetTop = 100;
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => rectangle(targetTop, targetTop + 1200));
    vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue(rectangle(0, 64));
    const fixture = TestBed.createComponent(ScrollToTopComponent);
    fixture.componentRef.setInput('target', target); fixture.componentRef.setInput('navigation', navigation); fixture.componentRef.setInput('page', 'Spells');
    fixture.detectChanges();
    const flush = () => { const callback = frame; frame = undefined; callback?.(0); fixture.detectChanges(); };
    const scroll = (top: number) => { targetTop = top; window.dispatchEvent(new Event('scroll')); flush(); };
    flush();
    return { fixture, target, navigation, scroll, flush, cancel };
  }

  afterEach(() => { TestBed.resetTestingModule(); document.body.querySelectorAll('div[tabindex="-1"], nav').forEach(node => node.remove()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('appears below sticky navigation only after the tab start has scrolled away, then hides on return', () => {
    const { fixture, scroll } = setup();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    scroll(-200);
    expect(fixture.nativeElement.querySelector('button').style.top).toBe('76px');
    scroll(76); expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it.each([false, true])('scrolls to the tab, restores focus and respects reduced motion (%s)', reduced => {
    const { fixture, target, scroll } = setup();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(700);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    scroll(-200); fixture.nativeElement.querySelector('button').click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 424, behavior: reduced ? 'instant' : 'smooth' });
    expect(document.activeElement).toBe(target);
  });

  it('remeasures when the active tab changes, handles desktop navigation and cancels pending work on removal', () => {
    const { fixture, scroll, flush, cancel } = setup(false);
    scroll(-100); expect(fixture.nativeElement.querySelector('button').style.top).toBe('12px');
    fixture.componentRef.setInput('page', 'Features'); fixture.detectChanges(); flush();
    expect(fixture.componentInstance.visible()).toBe(true);
    window.dispatchEvent(new Event('scroll')); fixture.destroy(); expect(cancel).toHaveBeenCalled();
  });
});
