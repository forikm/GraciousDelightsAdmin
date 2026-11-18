const VIEWS = [
  ['pending', 'Needs review'],
  ['active', 'Accepted & ready'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['declined', 'Declined'],
  ['all', 'All requests']
];
const STATUSES = {
  pending: 'Awaiting review', accepted: 'Accepted', ready: 'Ready',
  completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled'
};
const TRANSITIONS = {
  pending: ['accepted', 'declined'],
  accepted: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled']
};
const ACTION_LABELS = {
  accepted: 'Accept request', declined: 'Decline request', ready: 'Mark ready',
  completed: 'Mark completed', cancelled: 'Cancel order'
};
const ACTION_HELP = {
  accepted: 'The customer will see that you accepted the request. Its items stay reserved.',
  ready: 'The customer will see that their order is ready.',
  completed: 'Mark as fulfilled and deduct the items from stock.',
  declined: 'This releases the reserved products for other customers.',
  cancelled: 'This releases the reserved products for other customers.'
};

function deliveryPinLink(location) {
  if (!Number.isFinite(location?.lat) || Math.abs(location.lat) > 90 ||
      !Number.isFinite(location?.lng) || Math.abs(location.lng) > 180) return '';
  return `<br><a href="https://www.google.com/maps/search/?api=1&amp;query=${location.lat},${location.lng}" target="_blank" rel="noopener noreferrer">Open delivery pin in Google Maps</a>`;
}

export function createOrderingUI(ui) {
  const {getState, commit, openModal, bindForm, formFooter, toast, money, esc, icon} = ui;
  const $ = selector => document.querySelector(selector);
  const orders = () => getState().orders || [];
  const date = new Intl.DateTimeFormat('en-PH', {dateStyle:'medium', timeStyle:'short'});
  let filter = 'pending';

  const inProgress = order => ['accepted', 'ready'].includes(order.status);
  const filtered = view => orders().filter(order => view === 'all' ||
    (view === 'active' ? inProgress(order) : order.status === view));
  const pendingCount = () => filtered('pending').length;
  const countLabel = count => `${count} ${count === 1 ? 'request' : 'requests'}`;

  function itemSummary(order) {
    return `<div class="order-items">${order.items.map(item => `
      <div><span>${item.quantity} × ${esc(item.name)}</span><strong>${money(item.lineTotal)}</strong></div>
    `).join('')}<div class="order-total"><span>Product total</span><strong>${money(order.total)}</strong></div></div>`;
  }

  function orderActions(order) {
    const transitions = TRANSITIONS[order.status];
    if (!transitions) return '';
    return `<div class="order-actions">${transitions.map((next, index) => `
      <button class="button ${index === 0 ? 'primary' : 'secondary'}" data-action="order-status"
        data-id="${esc(order.id)}" data-status="${next}" aria-label="${ACTION_LABELS[next]} ${esc(order.reference)}">
        ${ACTION_LABELS[next]}
      </button>`).join('')}</div>`;
  }

  function orderCards(shown) {
    if (!shown.length) {
      return `<div class="empty-state"><h3>${filter === 'pending' ? 'No requests need review' : 'No requests in this view'}</h3>
        <p>${filter === 'pending' ? 'New customer requests will appear here.' : 'Choose another status to see more requests.'}</p></div>`;
    }
    return shown.map(order => `<article class="admin-order-card" data-order-id="${esc(order.id)}">
      <div class="order-heading">
        <div><h3>${esc(order.reference)}</h3><time datetime="${esc(order.createdAt)}">${date.format(new Date(order.createdAt))}</time></div>
        <span class="order-status status-${esc(order.status)}">${esc(STATUSES[order.status] || order.status)}</span>
      </div>
      <div class="admin-order-columns">
        <div class="order-customer">
          <h4>${esc(order.customer.name)}</h4>
          <a href="tel:${esc(order.customer.phone.replace(/[^+\d]/g, ''))}">${icon('phone')}${esc(order.customer.phone)}</a>
          <p><strong>${order.customer.fulfillment === 'pickup' ? 'Pickup' : 'Delivery requested'}</strong>
          ${order.customer.address ? `<br>${esc(order.customer.address)}` : ''}${deliveryPinLink(order.customer.location)}</p>
          ${order.customer.notes ? `<p class="customer-notes">${esc(order.customer.notes)}</p>` : ''}
        </div>
        ${itemSummary(order)}
      </div>
      ${order.adminNote ? `<p class="admin-order-note"><strong>Message to customer:</strong> ${esc(order.adminNote)}</p>` : ''}
      ${orderActions(order)}
    </article>`).join('');
  }

  function adminOrders() {
    const shown = filtered(filter);
    return `<section class="order-inbox" aria-labelledby="inbox-title">
      <div class="orders-toolbar">
        <div><h2 id="inbox-title">Order inbox</h2><p class="inbox-count" id="orders-count" role="status">${countLabel(shown.length)}</p></div>
        <label for="order-filter">Filter by status
          <select id="order-filter">
            ${VIEWS.map(([value, label]) => `<option value="${value}" ${filter === value ? 'selected' : ''}>${label} (${filtered(value).length})</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="orders-list">${orderCards(shown)}</div>
      <details class="order-help"><summary>How orders affect stock</summary><p>Open requests reserve finished products. Completion deducts those units from stock. Declining or cancelling releases the reservation. Production accounts for ingredients separately.</p></details>
    </section>`;
  }

  function wireAdmin() {
    $('#order-filter')?.addEventListener('change', event => {
      filter = event.target.value;
      const shown = filtered(filter);
      // Keep the native filter mounted while replacing its results.
      $('#orders-list').innerHTML = orderCards(shown);
      $('#orders-count').textContent = countLabel(shown.length);
    });
  }

  function updateOrder(id, next) {
    const order = orders().find(order => order.id === id);
    if (!order || !TRANSITIONS[order.status]?.includes(next)) return;
    const revision = getState().revision;
    const label = ACTION_LABELS[next];
    const requiresReason = ['declined', 'cancelled'].includes(next);
    openModal(`${label} · ${order.reference}`, `<form>
      ${itemSummary(order)}
      <p class="modal-description">${ACTION_HELP[next]}</p>
      <label>${requiresReason ? 'Reason (visible to the customer)' : 'Message to customer (optional)'}
        <textarea name="note" maxlength="500" rows="3" ${requiresReason ? 'required' : ''}>${requiresReason ? '' : esc(order.adminNote)}</textarea>
      </label>
      ${formFooter(label)}
    </form>`);
    bindForm(async data => {
      await commit({type:'updateOrder', id, status:next, actor:'admin', note:data.get('note') || ''}, revision);
      toast(`${order.reference}: ${STATUSES[next]}.`);
    });
  }

  function handleAction(action, id, element) {
    if (action === 'order-status') updateOrder(id, element.dataset.status);
  }

  return {pendingCount, adminOrders, wireAdmin, handleAction, refresh() {}};
}
