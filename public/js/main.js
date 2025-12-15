// Confirmation dialog for elements with data-confirm attribute
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-confirm]');
  if (!el) return;

  const message = el.getAttribute('data-confirm');
  // If user cancels, prevent the default action
  if (!window.confirm(message)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.budget-form');
  if (!form) return;
  if (!window.fetch) return;

  e.preventDefault();
  const messageEl = document.getElementById('budget-form-message');
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.classList.remove('error', 'success');
  }

  const formData = new FormData(form);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  try {
    const resp = await fetch(form.action || '/budgets', {
      method: form.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const err = data && data.error ? data.error : 'An error occurred while saving the budget.';
      if (messageEl) {
        messageEl.textContent = err;
        messageEl.classList.add('error');
      } else {
        alert(err);
      }
      return;
    }

    // success
    if (messageEl) {
      messageEl.textContent = data && data.success ? 'Budget saved.' : 'Budget saved.';
      messageEl.classList.add('success');
    }

    // clear form fields
    form.reset();

    // Optionally: append the new budget to the list if returned
    if (data && data.budget) {
      try {
        const countEl = document.getElementById('budgets-count');
        if (countEl) {
          const n = Number(countEl.textContent) || 0;
          countEl.textContent = String(n + 1);
        }

        let list = document.querySelector('.current-budgets-list');
        if (!list) {
          const h2s = Array.from(document.querySelectorAll('h2'));
          const targetH2 =
            h2s.find((h) => h.textContent && h.textContent.includes('Existing Budgets')) || h2s[0];
          const section = document.createElement('section');
          section.className = 'current-budgets-list';
          if (targetH2 && targetH2.parentNode)
            targetH2.parentNode.insertBefore(section, targetH2.nextSibling);
          list = section;

          try {
            const maybePara = Array.from(document.querySelectorAll('p')).find((p) =>
              /no budgets/i.test(p.textContent)
            );
            if (maybePara && maybePara.parentNode) maybePara.parentNode.removeChild(maybePara);
          } catch (err) {
            // ignore
          }
        }

        const div = document.createElement('div');
        div.className = 'budget-card';
        div.innerHTML = `
          <h3>${data.budget.category}</h3>
          <p><strong>Limit:</strong> $${Number(data.budget.amountLimit).toFixed(2)} <br>
          <strong>Period:</strong> ${data.budget.startDate} to ${data.budget.endDate}</p>
          <form method="POST" action="/budgets/delete" class="delete-form">
            <input type="hidden" name="budgetId" value="${data.budget._id}">
            <button type="submit" class="delete-button" data-confirm="Delete ${
              data.budget.category
            } budget?">Delete</button>
          </form>
        `;
        list.prepend(div);
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    if (messageEl) {
      messageEl.textContent = 'Network error while saving the budget.';
      messageEl.classList.add('error');
    } else {
      alert('Network error while saving the budget.');
    }
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.utilities-form');
  if (!form) return;

  if (!window.fetch) return;

  e.preventDefault();
  const messageEl = document.getElementById('utilities-form-message');
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.classList.remove('error', 'success');
  }

  const formData = new FormData(form);
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  try {
    const resp = await fetch(form.action || '/utilities', {
      method: form.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const err = data && data.error ? data.error : 'An error occurred while creating the utility.';
      if (messageEl) {
        messageEl.textContent = err;
        messageEl.classList.add('error');
      } else {
        alert(err);
      }
      return;
    }

    // success
    if (messageEl) {
      messageEl.textContent = data && data.success ? 'Utility saved.' : 'Utility saved.';
      messageEl.classList.add('success');
    }

    // clear form
    form.reset();

    // append newly created utility to list if provided
    if (data && data.utility) {
      try {
        let list =
          document.getElementById('utilities-list') ||
          document.querySelector('.current-utilities-list');
        if (!list) {
          const section = document.createElement('section');
          section.id = 'utilities-list';
          section.className = 'current-utilities-list';

          const hr = document.querySelector('.utility-form + hr');
          if (hr && hr.parentNode) {
            hr.parentNode.insertBefore(section, hr.nextSibling);
          } else {
            const formSection = document.querySelector('.utility-form');
            if (formSection && formSection.parentNode) {
              formSection.parentNode.insertBefore(section, formSection.nextSibling);
            } else {
              const h2s = Array.from(document.querySelectorAll('h2'));
              const targetH2 =
                h2s.find((h) => h.textContent && h.textContent.includes('Add a Utility')) || h2s[0];
              if (targetH2 && targetH2.parentNode)
                targetH2.parentNode.insertBefore(section, targetH2.nextSibling);
            }
          }

          list = section;

          try {
            const placeholder = document.getElementById('no-utilities-placeholder');
            if (placeholder && placeholder.parentNode)
              placeholder.parentNode.removeChild(placeholder);
          } catch (err) {
            // ignore
          }
        }

        const div = document.createElement('div');
        div.className = 'utility-card';
        div.innerHTML = `
          <h3>${data.utility.provider}</h3>
          <div class="utility-meta">
            <span><strong>Account:</strong> ${data.utility.accountNumber}</span>
            <span><strong>Default day:</strong> ${data.utility.defaultDay || '—'}</span>
            <span><strong>Default amount:</strong> $${(
              Number(data.utility.defaultAmount) || 0
            ).toFixed(2)}</span>
            <span><strong>Notes:</strong> ${data.utility.notes || '—'}</span>
          </div>
          <div class="utility-actions">
            <a href="/utilities/${data.utility._id}/bills" class="btn btn-info">View Bills</a>
            <a href="/utilities/${data.utility._id}/edit" class="btn btn-primary">Edit</a>
            <form action="/utilities/${data.utility._id}/delete" method="post">
              <button class="btn btn-danger" data-confirm="Delete ${
                data.utility.provider
              }?">Delete</button>
            </form>
            <form action="/utilities/${data.utility._id}/toggle" method="post">
              <button class="btn btn-warning">Deactivate</button>
            </form>
          </div>
        `;
        list.appendChild(div);
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    if (messageEl) {
      messageEl.textContent = 'Network error while creating the utility.';
      messageEl.classList.add('error');
    } else {
      alert('Network error while creating the utility.');
    }
  }
});

(() => {
  const test = document.createElement('input');
  test.setAttribute('type', 'month');
  const supportsMonth = test.type === 'month';
  if (supportsMonth) return;

  document.addEventListener('DOMContentLoaded', () => {
    const monthInputs = document.querySelectorAll('input[type="month"]');
    monthInputs.forEach((inp) => {
      inp.type = 'text';
      if (!inp.getAttribute('placeholder')) inp.setAttribute('placeholder', 'YYYY-MM');
      if (!inp.getAttribute('pattern')) inp.setAttribute('pattern', '\\d{4}-\\d{2}');
      inp.setAttribute('inputmode', 'numeric');
    });

    const historyForm = document.querySelector('.history-filter-form');
    if (historyForm) {
      historyForm.addEventListener('submit', (e) => {
        const m = document.getElementById('month');
        if (m && m.value) {
          const re = /^\d{4}-\d{2}$/;
          if (!re.test(m.value)) {
            e.preventDefault();
            alert('Please enter month as YYYY-MM (e.g. 2025-12)');
            m.focus();
          }
        }
      });
    }
  });
})();
