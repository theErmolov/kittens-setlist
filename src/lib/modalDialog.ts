/** Native modal behavior: focus trap, Escape, and focus restoration. */
export function modalDialog(node: HTMLDialogElement, onclose: () => void) {
  const previous = document.activeElement;
  const scrollY = window.scrollY;
  const bodyStyle = {
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
  };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  node.showModal();
  const cancel = (event: Event) => { event.preventDefault(); onclose(); };
  node.addEventListener('cancel', cancel);
  return { destroy() {
    node.removeEventListener('cancel', cancel);
    node.close();
    document.body.style.position = bodyStyle.position;
    document.body.style.top = bodyStyle.top;
    document.body.style.width = bodyStyle.width;
    document.body.style.overflow = bodyStyle.overflow;
    window.scrollTo(0, scrollY);
    if (previous instanceof HTMLElement) previous.focus();
  } };
}
