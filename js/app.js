// app.js — Init & Routing
const Toast = (() => {
  function show(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success:'fa-circle-check', danger:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('hiding');
      el.addEventListener('animationend', () => el.remove());
    }, 3000);
  }
  return { show };
})();

const App = (() => {
  let _currentPage = 'dashboard';

  function navigate(page) {
    _currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-item, .bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Render page-specific content
    if (page === 'data') {
      TableManager.renderAll();
      renderFilterBar();
    } else if (page === 'dashboard') {
      renderDashboard();
    } else if (page === 'log') {
      renderLog();
    } else if (page === 'settings') {
      renderSettings();
    }

    closeSidebar();
  }

  // ── Sidebar mobile ──────────────────────────────────────────
  function openSidebar() {
    document.querySelector('.sidebar')?.classList.add('open');
    document.querySelector('.sidebar-overlay')?.classList.add('open');
  }
  function closeSidebar() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('open');
  }

  // ── Dashboard ───────────────────────────────────────────────
  function renderDashboard() {
    const s = Data.getStats();
    const el = n => document.getElementById(n);

    if (el('dash-groups')) el('dash-groups').textContent = s.totalGroups;
    if (el('dash-rows'))   el('dash-rows').textContent   = s.totalRows;

    // Recent KD list
    const names = Data.getGroupNames().slice(0, 8);
    const listEl = el('dash-kd-list');
    if (listEl) {
      if (names.length === 0) {
        listEl.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">Belum ada data</td></tr>';
      } else {
        listEl.innerHTML = names.map(kd => {
          const cnt = Data.getGroup(kd).length;
          return `<tr>
            <td><span style="font-family:var(--font-mono);color:var(--accent);font-size:12px">${kd}</span></td>
            <td style="text-align:center">${cnt}</td>
            <td>
              <button class="btn btn-xs btn-secondary" onclick="App.navigate('data');setTimeout(()=>TableManager.setFilter('','${kd}'),100)">
                <i class="fa-solid fa-eye"></i> Lihat
              </button>
            </td>
          </tr>`;
        }).join('');
      }
    }

    // Activity
    const log = Data.getLog().slice(0, 5);
    const logEl = el('dash-activity');
    if (logEl) {
      if (log.length === 0) {
        logEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">Belum ada aktivitas</div>';
      } else {
        const icons = { add:'fa-plus add', edit:'fa-pen edit', delete:'fa-trash delete', import:'fa-file-import edit' };
        logEl.innerHTML = log.map(l => {
          const cls = icons[l.action] || 'fa-circle-dot edit';
          const time = new Date(l.ts).toLocaleString('id-ID', {hour:'2-digit',minute:'2-digit', day:'2-digit', month:'short'});
          return `<div class="activity-item">
            <div class="activity-icon ${l.action}"><i class="fa-solid ${cls.split(' ')[0]}"></i></div>
            <div class="activity-text">${l.detail}</div>
            <div class="activity-time">${time}</div>
          </div>`;
        }).join('');
      }
    }
  }

  // ── Filter bar for data page ────────────────────────────────
  function renderFilterBar() {
    const searchEl = document.getElementById('filter-search');
    const kdEl = document.getElementById('filter-kd');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        TableManager.setFilter(searchEl.value, kdEl?.value);
      });
    }
    if (kdEl) {
      kdEl.addEventListener('change', () => {
        TableManager.setFilter(searchEl?.value, kdEl.value);
      });
    }
  }

  // ── Log page ────────────────────────────────────────────────
  function renderLog() {
    const container = document.getElementById('log-container');
    if (!container) return;
    const log = Data.getLog();
    if (log.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p>Belum ada riwayat</p>
      </div>`;
      return;
    }
    const icons = { add:'fa-plus', edit:'fa-pen', delete:'fa-trash', import:'fa-file-import' };
    container.innerHTML = `<div class="activity-list">${log.map(l => {
      const time = new Date(l.ts).toLocaleString('id-ID', {
        day:'2-digit', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      });
      return `<div class="activity-item">
        <div class="activity-icon ${l.action}"><i class="fa-solid ${icons[l.action]||'fa-circle-dot'}"></i></div>
        <div class="activity-text"><strong>${l.action.toUpperCase()}</strong> — ${l.detail}</div>
        <div class="activity-time">${time}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // ── Settings page ───────────────────────────────────────────
  function renderSettings() {
    const toggleAuto = document.getElementById('setting-auto-expand');
    const toggleConfirm = document.getElementById('setting-confirm-delete');
    if (toggleAuto) {
      toggleAuto.checked = Data.getSetting('autoExpand');
      toggleAuto.onchange = () => Data.setSetting('autoExpand', toggleAuto.checked);
    }
    if (toggleConfirm) {
      toggleConfirm.checked = Data.getSetting('confirmDelete');
      toggleConfirm.onchange = () => Data.setSetting('confirmDelete', toggleConfirm.checked);
    }
  }

  // ── Deteksi Mobile ──────────────────────────────────────────
  function detectMobile() {
    const isTouch  = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const isNarrow = window.innerWidth <= 900;
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isTouch || isMobileUA || isNarrow) {
      document.body.classList.add('is-mobile');
    } else {
      document.body.classList.remove('is-mobile');
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    detectMobile();
    window.addEventListener('resize', detectMobile);
    Data.init();

    KDPicker.init((kd) => {
      const preview = document.getElementById('kd-preview');
      if (preview) preview.innerHTML = `KD yang dipilih: <strong>${kd}</strong>`;
    });

    InputManager.init((kd, row) => {
      TableManager.renderGroup(kd);
      TableManager.updateStats();
      renderDashboard();
    });

    // Nav links — pakai pointerdown agar responsif di mobile (tidak ada 300ms delay)
    document.querySelectorAll('[data-page]').forEach(el => {
      let _tapped = false;
      el.addEventListener('pointerdown', (e) => {
        _tapped = true;
        navigate(el.dataset.page);
      });
      // fallback click untuk non-touch
      el.addEventListener('click', (e) => {
        if (!_tapped) navigate(el.dataset.page);
        _tapped = false;
      });
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', openSidebar);
    document.querySelector('.sidebar-overlay')?.addEventListener('click', closeSidebar);

    // Edit modal close
    document.getElementById('btn-edit-cancel')?.addEventListener('click', () => {
      document.getElementById('edit-modal')?.classList.add('hidden');
    });
    document.getElementById('edit-modal-close')?.addEventListener('click', () => {
      document.getElementById('edit-modal')?.classList.add('hidden');
    });

    // Camera modal close
    document.getElementById('btn-camera-close')?.addEventListener('click', InputManager.closeCamera);

    // Export buttons
    document.getElementById('btn-export-xls')?.addEventListener('click', () => {
      const kd = document.getElementById('filter-kd')?.value || '';
      Exporter.exportXLS(kd || null);
    });
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
      const kd = document.getElementById('filter-kd')?.value || '';
      Exporter.exportPDF(kd || null);
    });
    document.getElementById('btn-export-json')?.addEventListener('click', Exporter.exportJSON);
    document.getElementById('btn-import-json')?.addEventListener('click', Exporter.importJSON);

    // Clear all (settings)
    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      if (window.confirm('Hapus SEMUA data? Tindakan ini tidak dapat dibatalkan.')) {
        Data.clearAll();
        TableManager.renderAll();
        renderDashboard();
        Toast.show('Semua data dihapus.', 'danger');
      }
    });

    // Start on dashboard
    navigate('dashboard');
  }

  return { init, navigate };
})();

document.addEventListener('DOMContentLoaded', App.init);