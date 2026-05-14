// table.js — Render & Inline Edit
const TableManager = (() => {
  const COLS = [
    'Vendor','PO Number','Date','Quantity','Material',
    'Batch/Box','Serial Number','Storage Loc','Customer',
    'Delivery Type','Destination','Pallet','Plant','Z Value'
  ];

  let _sortField = null;
  let _sortDir = 1; // 1 asc, -1 desc
  let _filterText = '';
  let _filterKD = '';
  let _openGroups = new Set();

  // ── Build column header row ─────────────────────────────────
  function buildThead() {
    return `<thead><tr>
      <th class="td-no">#</th>
      ${COLS.map(c => `
        <th data-col="${c}" onclick="TableManager.sortBy('${c}')">
          ${c}<span class="sort-icon"></span>
        </th>`).join('')}
      <th style="width:70px">Aksi</th>
    </tr></thead>`;
  }

  // ── Build one row ───────────────────────────────────────────
  function buildRow(row, idx) {
    const cells = COLS.map(col => {
      const val = row[col] !== undefined ? row[col] : '';
      const safeVal = String(val).replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const display = _filterText
        ? highlight(String(val), _filterText)
        : escapeHtml(String(val));
      return `<td class="td-editable"
        data-id="${row._id}" data-kd="${row._kd}" data-col="${col}"
        title="${safeVal}"
        ondblclick="TableManager.startEdit(this)">${display}</td>`;
    }).join('');

    return `<tr data-id="${row._id}">
      <td class="td-no">${idx + 1}</td>
      ${cells}
      <td>
        <div class="td-actions">
          <button class="btn btn-xs btn-secondary btn-icon" title="Edit baris"
            onclick="TableManager.editRow('${row._kd}','${row._id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-xs btn-danger btn-icon" title="Hapus baris"
            onclick="TableManager.deleteRow('${row._kd}','${row._id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }

  // ── Build one KD group ──────────────────────────────────────
  function buildGroup(kd, rows) {
    const isOpen = _openGroups.has(kd);
    const filtered = filterRows(rows);
    if (_filterText && filtered.length === 0) return '';
    if (_filterKD && kd !== _filterKD) return '';

    const sorted = sortRows(filtered);

    return `<div class="kd-group" id="group-${safeId(kd)}">
      <div class="kd-group-header" onclick="TableManager.toggleGroup('${kd}')">
        <i class="fa-solid fa-chevron-right kd-toggle-icon ${isOpen ? 'open' : ''}"></i>
        <span class="kd-group-name">${kd}</span>
        <span class="kd-group-count">${filtered.length} baris</span>
        <div class="kd-group-actions" onclick="event.stopPropagation()">
          <button class="btn btn-xs btn-secondary btn-icon" title="Tambah baris ke grup ini"
            onclick="TableManager.focusInputForKD('${kd}')">
            <i class="fa-solid fa-plus"></i>
          </button>
          <button class="btn btn-xs btn-danger btn-icon" title="Hapus grup"
            onclick="TableManager.deleteGroup('${kd}')">
            <i class="fa-solid fa-layer-group"></i>
          </button>
        </div>
      </div>
      <div class="kd-group-body ${isOpen ? 'open' : ''}" id="body-${safeId(kd)}">
        <div class="table-wrap">
          <table class="data-table">
            ${buildThead()}
            <tbody>
              ${sorted.length > 0
                ? sorted.map((r, i) => buildRow(r, i)).join('')
                : `<tr><td colspan="${COLS.length + 2}" class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">
                    Tidak ada data
                  </td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  // ── Render all groups ───────────────────────────────────────
  function renderAll() {
    const container = document.getElementById('data-container');
    if (!container) return;
    const groups = Data.getGroups();
    const names = Data.getGroupNames();

    if (names.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p>Belum ada data</p>
        <small>Pilih KD dan masukkan data scan di tab Input</small>
      </div>`;
      return;
    }

    // Auto open new groups
    names.forEach(kd => {
      if (!_openGroups.has(kd) && Data.getSetting('autoExpand')) {
        _openGroups.add(kd);
      }
    });

    const html = names.map(kd => buildGroup(kd, groups[kd] || [])).join('');
    container.innerHTML = html || `<div class="empty-state">
      <i class="fa-solid fa-filter"></i>
      <p>Tidak ada hasil untuk filter ini</p>
    </div>`;

    updateKDFilter(names);
    updateStats();
  }

  // ── Re-render single group ──────────────────────────────────
  function renderGroup(kd) {
    const el = document.getElementById(`group-${safeId(kd)}`);
    if (!el) { renderAll(); return; }
    const rows = Data.getGroup(kd);
    const newEl = document.createElement('div');
    newEl.innerHTML = buildGroup(kd, rows);
    const child = newEl.firstElementChild;
    if (child) el.replaceWith(child);
    updateStats();
  }

  // ── Toggle group open/close ─────────────────────────────────
  function toggleGroup(kd) {
    if (_openGroups.has(kd)) _openGroups.delete(kd);
    else _openGroups.add(kd);

    const body = document.getElementById(`body-${safeId(kd)}`);
    const icon = document.querySelector(`#group-${safeId(kd)} .kd-toggle-icon`);
    if (body) body.classList.toggle('open', _openGroups.has(kd));
    if (icon) icon.classList.toggle('open', _openGroups.has(kd));
  }

  // ── Inline cell edit ────────────────────────────────────────
  function startEdit(td) {
    if (td.querySelector('input')) return; // already editing
    const kd = td.dataset.kd;
    const id = td.dataset.id;
    const col = td.dataset.col;
    const current = td.textContent.trim();

    td.classList.add('editing');
    const input = document.createElement('input');
    input.value = current;
    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      const val = input.value.trim();
      Data.editCell(kd, id, col, val);
      td.classList.remove('editing');
      td.innerHTML = escapeHtml(val) || '&nbsp;';
      td.dataset.id = id; td.dataset.kd = kd; td.dataset.col = col;
      updateStats();
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') {
        td.classList.remove('editing');
        td.innerHTML = escapeHtml(current);
        td.dataset.id = id; td.dataset.kd = kd; td.dataset.col = col;
      }
    });
  }

  // ── Edit row (modal) ────────────────────────────────────────
  function editRow(kd, id) {
    const row = Data.getGroup(kd).find(r => r._id === id);
    if (!row) return;

    const skip = ['_id','_kd','_ts','_edited'];
    const fields = Object.keys(row).filter(k => !skip.includes(k));

    const body = document.getElementById('edit-modal-body');
    if (!body) return;
    body.innerHTML = fields.map(f => `
      <div class="form-group">
        <label class="form-label">${f}</label>
        <input class="form-control" data-field="${f}" value="${escapeHtml(String(row[f] ?? ''))}" />
      </div>`).join('');

    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('hidden');

    const btnSave = document.getElementById('btn-edit-save');
    if (btnSave) {
      btnSave.onclick = () => {
        body.querySelectorAll('input[data-field]').forEach(inp => {
          Data.editCell(kd, id, inp.dataset.field, inp.value.trim());
        });
        modal.classList.add('hidden');
        renderGroup(kd);
        Toast.show('Baris diperbarui.', 'success');
      };
    }
  }

  // ── Delete row ──────────────────────────────────────────────
  function deleteRow(kd, id) {
    const confirm = Data.getSetting('confirmDelete');
    if (confirm && !window.confirm(`Hapus baris ini dari ${kd}?`)) return;
    Data.deleteRow(kd, id);
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      tr.style.opacity = '0';
      tr.style.transition = 'opacity 0.2s';
      setTimeout(() => renderGroup(kd), 200);
    } else { renderGroup(kd); }
    Toast.show('Baris dihapus.', 'danger');
  }

  // ── Delete group ────────────────────────────────────────────
  function deleteGroup(kd) {
    if (!window.confirm(`Hapus seluruh grup "${kd}" beserta semua datanya?`)) return;
    Data.deleteGroup(kd);
    _openGroups.delete(kd);
    renderAll();
    Toast.show(`Grup ${kd} dihapus.`, 'danger');
  }

  // ── Focus input tab for specific KD ─────────────────────────
  function focusInputForKD(kd) {
    KDPicker.setKD(kd);
    App.navigate('input');
    setTimeout(() => {
      const ta = document.getElementById('main-input');
      if (ta) ta.focus();
    }, 100);
  }

  // ── Sort ────────────────────────────────────────────────────
  function sortBy(col) {
    if (_sortField === col) _sortDir *= -1;
    else { _sortField = col; _sortDir = 1; }
    renderAll();
    document.querySelectorAll('.data-table thead th').forEach(th => {
      th.classList.remove('sorted-asc','sorted-desc');
    });
    const th = document.querySelector(`[data-col="${col}"]`);
    if (th) th.classList.add(_sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
  }

  function sortRows(rows) {
    if (!_sortField) return rows;
    return [...rows].sort((a, b) => {
      const va = a[_sortField] ?? '';
      const vb = b[_sortField] ?? '';
      if (!isNaN(va) && !isNaN(vb)) return (Number(va) - Number(vb)) * _sortDir;
      return String(va).localeCompare(String(vb)) * _sortDir;
    });
  }

  // ── Filter ──────────────────────────────────────────────────
  function filterRows(rows) {
    if (!_filterText) return rows;
    const q = _filterText.toLowerCase();
    return rows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  }

  function setFilter(text, kd) {
    _filterText = text ?? _filterText;
    _filterKD   = kd  ?? _filterKD;
    renderAll();
  }

  function updateKDFilter(names) {
    const sel = document.getElementById('filter-kd');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">Semua KD</option>` +
      names.map(n => `<option value="${n}" ${n === cur ? 'selected' : ''}>${n}</option>`).join('');
  }

  // ── Stats sidebar ───────────────────────────────────────────
  function updateStats() {
    const s = Data.getStats();
    const elG = document.getElementById('stat-groups');
    const elR = document.getElementById('stat-rows');
    if (elG) elG.textContent = s.totalGroups;
    if (elR) elR.textContent = s.totalRows;
  }

  // ── Helpers ─────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function highlight(text, query) {
    const esc = escapeHtml(text);
    if (!query) return esc;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return esc.replace(re, '<span class="highlight">$1</span>');
  }

  function safeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  }

  return {
    renderAll, renderGroup, toggleGroup,
    startEdit, editRow, deleteRow, deleteGroup,
    focusInputForKD, sortBy, setFilter, updateStats,
    cols: COLS,
  };
})();
