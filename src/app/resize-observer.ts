/** Keep layout writes out of ResizeObserver delivery and coalesce repeated notifications. */
export function observeResizeAfterFrame(elements: readonly Element[], measure: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  let frame: number | undefined;
  let disposed = false;
  const observer = new ResizeObserver(() => {
    if (disposed || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (!disposed) measure();
    });
  });
  elements.forEach(element => observer.observe(element));
  measure();
  return () => {
    disposed = true;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
