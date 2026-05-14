// kd.js — KD Picker Logic
const KDPicker = (() => {
  // Options per slot
  const SLOT2 = [
    { group: 'Khusus', opts: ['AA'] },
    { group: 'D-Series', opts: Array.from({length:10}, (_,i) => `D${i+1}`) },
    { group: 'T-Series', opts: Array.from({length:10}, (_,i) => `T${i+1}`) },
  ];
  const SLOT3 = [
    { group: 'Khusus', opts: ['AA'] },
    { group: 'Nomor', opts: Array.from({length:10}, (_,i) => String(i+1).padStart(2,'0')) },
  ];

  let sel2 = 'D1';
  let sel3 = '01';
  let _onChange = null;

  function buildDropdown(containerId, slots, getCurrent, onSelect) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    const btn = wrap.querySelector('.kd-picker-btn');
    const dropdown = wrap.querySelector('.kd-picker-dropdown');

    // Build options
    dropdown.innerHTML = '';
    slots.forEach(group => {
      const sec = document.createElement('div');
      sec.className = 'kd-picker-group';
      const lbl = document.createElement('div');
      lbl.className = 'kd-picker-group-label';
      lbl.textContent = group.group;
      sec.appendChild(lbl);
      group.opts.forEach(opt => {
        const el = document.createElement('div');
        el.className = 'kd-picker-opt' + (opt === getCurrent() ? ' selected' : '');
        el.textContent = opt;
        el.dataset.val = opt;
        el.addEventListener('click', () => {
          onSelect(opt);
          dropdown.querySelectorAll('.kd-picker-opt').forEach(o => {
            o.classList.toggle('selected', o.dataset.val === opt);
          });
          btn.querySelector('span').textContent = opt;
          closeAll();
          updatePreview();
          if (_onChange) _onChange(getKD());
        });
        sec.appendChild(el);
      });
      dropdown.appendChild(sec);
    });

    // Toggle open/close
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      closeAll();
      if (!isOpen) {
        dropdown.classList.add('open');
        // scroll selected into view
        const sel = dropdown.querySelector('.selected');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function closeAll() {
    document.querySelectorAll('.kd-picker-dropdown').forEach(d => d.classList.remove('open'));
  }

  function updatePreview() {
    const preview = document.getElementById('kd-preview');
    if (preview) {
      preview.innerHTML = `KD yang dipilih: <strong>${getKD()}</strong>`;
    }
    const btn2 = document.querySelector('#kd-slot2 .kd-picker-btn span');
    const btn3 = document.querySelector('#kd-slot3 .kd-picker-btn span');
    if (btn2) btn2.textContent = sel2;
    if (btn3) btn3.textContent = sel3;
  }

  function getKD() {
    return `KD - ${sel2} - ${sel3}`;
  }

  // Close dropdowns on outside click
  document.addEventListener('click', closeAll);

  return {
    init(onChangeCb) {
      _onChange = onChangeCb;

      buildDropdown('kd-slot2', SLOT2, () => sel2, v => { sel2 = v; });
      buildDropdown('kd-slot3', SLOT3, () => sel3, v => { sel3 = v; });

      updatePreview();
    },

    getKD,

    setKD(kd) {
      // parse "KD - D1 - 01"
      const parts = kd.split(' - ');
      if (parts.length === 3) {
        sel2 = parts[1];
        sel3 = parts[2];
        updatePreview();
      }
    },

    reset() {
      sel2 = 'D1'; sel3 = '01';
      updatePreview();
    },
  };
})();
