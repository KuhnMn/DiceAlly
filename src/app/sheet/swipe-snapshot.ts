export interface SwipeSnapshot {
  viewport: HTMLElement;
  content: HTMLElement;
  width: number;
}

/** A short-lived, inert picture of the visible pane. Angular views and form registrations stay untouched. */
export function captureSwipePane(host: HTMLElement, clipTop = 0): SwipeSnapshot | undefined {
  const box = host.getBoundingClientRect();
  const top = Math.max(0, box.top, clipTop);
  const height = Math.min(window.innerHeight, box.bottom) - top;
  if (box.width <= 0 || height <= 0) return;
  const viewport = document.createElement('div');
  viewport.dataset['swipeSnapshot'] = '';
  viewport.setAttribute('aria-hidden', 'true');
  viewport.inert = true;
  Object.assign(viewport.style, {
    position: 'fixed', left: `${box.left}px`, top: `${top}px`, width: `${box.width}px`,
    height: `${height}px`, overflow: 'hidden', pointerEvents: 'none', zIndex: '20',
  });
  const content = host.cloneNode(true) as HTMLElement;
  content.removeAttribute('id');
  for (const element of content.querySelectorAll('[id], [autofocus]')) {
    element.removeAttribute('id'); element.removeAttribute('autofocus');
  }
  const originalInputs = host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
  content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((element, index) => {
    element.value = originalInputs[index].value;
  });
  // Preserve nested tracker/list scroll positions, including native overflow containers.
  const originals = host.querySelectorAll<HTMLElement>('*');
  const copies = content.querySelectorAll<HTMLElement>('*');
  Object.assign(content.style, {
    position: 'absolute', left: '0', top: `${box.top - top}px`, margin: '0',
    width: `${box.width}px`, opacity: '1', visibility: 'visible', transform: 'translate3d(0, 0, 0)',
    pointerEvents: 'none', willChange: 'transform',
  });
  viewport.append(content);
  document.body.append(viewport);
  originals.forEach((original, index) => {
    if (original.scrollLeft || original.scrollTop) {
      copies[index].scrollLeft = original.scrollLeft; copies[index].scrollTop = original.scrollTop;
    }
  });
  // Hidden visited tabs need no second DOM tree during a swipe. Floating navigation stays outside the picture.
  content.querySelectorAll('.hidden, [hidden], app-scroll-to-top').forEach(element => element.remove());
  return { viewport, content, width: box.width };
}
