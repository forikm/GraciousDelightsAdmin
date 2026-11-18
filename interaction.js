const focusSelector = 'a[href], button, input, select, textarea, summary';

function focusKey(element) {
  return JSON.stringify([element.tagName, element.id, element.getAttribute('href'),
    element.getAttribute('name'), element.dataset.action, element.dataset.id,
    element.dataset.category, element.dataset.delta, element.dataset.status,
    element.getAttribute('aria-label')?.replace(/^Basket, \d+ items$/, 'Basket')]);
}

// A data refresh can replace a control. Keep the user on its equivalent.
export function rememberFocus(root) {
  const active = document.activeElement;
  if (!root.contains(active) || !active.matches(focusSelector)) return () => false;
  const key = focusKey(active);
  const matches = () => Array.from(root.querySelectorAll(focusSelector))
    .filter(element => focusKey(element) === key);
  const index = matches().indexOf(active);
  const selection = active.selectionStart === undefined ? null
    : [active.selectionStart, active.selectionEnd, active.selectionDirection];
  return () => {
    const element = active.isConnected ? active : matches().at(index);
    if (!element || element.matches(':disabled') || !element.getClientRects().length) return false;
    element.focus({preventScroll: true});
    if (selection?.[0] != null) element.setSelectionRange(...selection);
    return document.activeElement === element;
  };
}

export function focusHeading(heading, preventScroll = false) {
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({preventScroll});
}

export function dialogControls(dialog, {escape, checkIcon, closeIcon, fallback}) {
  let returnFocus;
  let busy = false;
  const close = () => {
    if (!busy && dialog.open) dialog.close();
  };
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener('keydown', event => {
    if (busy && event.key === 'Escape') event.preventDefault();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const restored = returnFocus?.();
    returnFocus = undefined;
    if (!restored) {
      const target = fallback();
      if (target?.matches('h1, h2')) focusHeading(target);
      else target?.focus();
    }
  });

  function openModal(title, body, className = '') {
    const sameStep = dialog.open && dialog.querySelector('#modal-title').textContent === title;
    const restoreStepFocus = sameStep ? rememberFocus(dialog) : () => false;
    if (!dialog.open) returnFocus = rememberFocus(document);
    dialog.dispatchEvent(new Event('dialog-content-change'));
    dialog.className = className;
    dialog.innerHTML = `<div class="modal-top"><h2 id="modal-title" tabindex="-1">${escape(title)}</h2><button class="icon-button close-modal" data-action="close" aria-label="Close dialog" ${busy?'disabled':''}>${closeIcon}</button></div><p class="dialog-status" role="status"></p>${body}`;
    if (!dialog.open) dialog.showModal();
    // Start each new step at its heading, where its purpose is announced.
    if (!restoreStepFocus()) focusHeading(dialog.querySelector('#modal-title'), true);
    if (!sameStep) dialog.scrollTop = 0;
  }

  function formFooter(label, back = '') {
    return `<p class="form-error" role="alert" id="form-error" tabindex="-1"></p><div class="modal-actions">${back || '<button class="button secondary" type="button" data-action="close">Cancel</button>'}<button class="button primary" type="submit">${escape(label)} ${checkIcon}</button></div>`;
  }

  function bindForm(handler, pendingLabel = 'Saving…') {
    const form = dialog.querySelector('form');
    const error = form.querySelector('#form-error');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(form);
      const actions = dialog.querySelectorAll('button[type="submit"], [data-action="close"], [data-action="checkout-back"], [data-action="toggle-product"]');
      actions.forEach(button => { button.setAttribute('aria-disabled', 'true'); });
      const submit = form.querySelector('button[type="submit"]');
      const originalLabel = submit.innerHTML;
      submit.textContent = pendingLabel;
      error.textContent = '';
      busy = true;
      dialog.setAttribute('closedby', 'none');
      const previousStatus = dialog.querySelector('.dialog-status');
      previousStatus.textContent = pendingLabel;
      try {
        const result = await handler(data);
        if (result !== false && form.isConnected) dialog.close();
      } catch (failure) {
        if (form.isConnected) {
          error.textContent = failure.message;
          error.focus();
        }
      } finally {
        busy = false;
        dialog.removeAttribute('closedby');
        submit.innerHTML = originalLabel;
        actions.forEach(button => { button.removeAttribute('aria-disabled'); });
        if (previousStatus.textContent === pendingLabel) previousStatus.textContent = '';
        const dismiss = dialog.querySelector('.close-modal');
        if (dismiss) dismiss.disabled = false;
      }
    });
  }

  return {openModal, formFooter, bindForm, close, isBusy: () => busy};
}
