const formatToday = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const updateError = (form, msg) => {
  let el = form.querySelector('.form-error');
  if (!msg) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = 'alert alert-danger form-error';
    form.prepend(el);
  }
  el.textContent = msg;
};

const validate = (form) => {
  const get = (sel) => form.querySelector(sel)?.value?.trim() || '';
  const title = get('input[name="title"]');
  const amount = get('input[name="amount"]');
  const category = get('input[name="category"]');
  const type = get('select[name="type"]');
  const date = get('input[name="date"]');
  if (!title) return 'Title is required.';
  if (!amount) return 'Amount is required.';
  if (Number.isNaN(Number(amount))) return 'Amount must be a number.';
  if (!category) return 'Category is required.';
  if (!type) return 'Type is required.';
  if (!date) return 'Date is required.';
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return 'Date is not valid.';
  dt.setHours(0, 0, 0, 0);
  const today = new Date(formatToday());
  if (dt.getTime() > today.getTime()) return 'Date cannot be in the future.';
  return null;
};

const disableBtn = (btn, disable) => {
  if (!btn) return;
  btn.disabled = disable;
  if (disable) (btn.dataset.origText = btn.textContent), (btn.textContent = 'Saving...');
  else btn.textContent = btn.dataset.origText || 'Save';
};

const submit = async (form) => {
  updateError(form, null);
  const err = validate(form);
  if (err) return updateError(form, err);

  const btn = form.querySelector('button[type="submit"]');
  if (btn && btn.disabled) return;
  disableBtn(btn, true);

  try {
    const params = new URLSearchParams(new FormData(form));
    const res = await fetch(form.action, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });
    if (res.ok) return (window.location.href = '/transactions');
    const text = await res.text().catch(() => null);
    updateError(form, text || 'Server returned an error while saving.');
  } catch (e) {
    updateError(form, e.message || 'Network error');
  } finally {
    disableBtn(btn, false);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll(
    'form[action="/transactions"], form[action*="/transactions/edit"]'
  );
  forms.forEach((form) => {
    const dateInput = form.querySelector('input[type="date"][name="date"]');
    if (dateInput) dateInput.max = formatToday();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit(form);
    });
  });
});
