/** Native modal behavior: focus trap, Escape, and focus restoration. */
export function modalDialog(node: HTMLDialogElement, onclose: () => void) {
  const previous = document.activeElement;
  node.showModal();
  const cancel = (event: Event) => { event.preventDefault(); onclose(); };
  node.addEventListener('cancel', cancel);
  return { destroy() { node.removeEventListener('cancel', cancel); node.close(); if (previous instanceof HTMLElement) previous.focus(); } };
}
