// data.js — Storage & Data Management
const DB_KEY = 'ditzscan_data';
const LOG_KEY = 'ditzscan_log';
const SETTINGS_KEY = 'ditzscan_settings';

const Data = (() => {
  // ── Internal state ──────────────────────────────────────────
  let _groups = {};   // { "KD - D1 - 01": [ {id, fields...}, ... ] }
  let _log    = [];
  let _settings = { autoExpand: true, confirmDelete: true };

  // ── Helpers ─────────────────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function save() {
    localStorage.setItem(DB_KEY, JSON.stringify(_groups));
    localStorage.setItem(LOG_KEY, JSON.stringify(_log.slice(-200)));
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      _groups = raw ? JSON.parse(raw) : {};
    } catch { _groups = {}; }
    try {
      const rawLog = localStorage.getItem(LOG_KEY);
      _log = rawLog ? JSON.parse(rawLog) : [];
    } catch { _log = []; }
    try {
      const rawS = localStorage.getItem(SETTINGS_KEY);
      if (rawS) _settings = { ..._settings, ...JSON.parse(rawS) };
    } catch {}
  }

  function addLog(action, detail) {
    _log.unshift({ action, detail, ts: new Date().toISOString() });
    if (_log.length > 200) _log.pop();
    localStorage.setItem(LOG_KEY, JSON.stringify(_log));
  }

  // ── Parse barcode/scan string ───────────────────────────────
  function parseString(str) {
    if (!str || !str.trim()) return null;
    const raw = str.trim();
    const result = {};
    const parts = raw.split(';');
    parts.forEach(part => {
      const idx = part.indexOf(':');
      if (idx > -1) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k) result[k] = v;
      }
    });
    // normalise common keys → friendly names
    const map = {
      V: 'Vendor', PO: 'PO Number', D: 'Date', Q: 'Quantity',
      M: 'Material', B: 'Batch/Box', S: 'Serial Number',
      ST: 'Storage Loc', C: 'Customer', DT: 'Delivery Type',
      DS: 'Destination', PA: 'Pallet', P: 'Plant', Z: 'Z Value',
      F: 'Flag', DE: 'Desc', YX: 'Exp Date', SN: 'SN',
      VM: 'VM', CM: 'CM', CS: 'CS', LOT: 'LOT', DN: 'DN',
    };
    const friendly = {};
    Object.entries(result).forEach(([k, v]) => {
      friendly[map[k] || k] = v;
    });
    // clean up Quantity
    if (friendly['Quantity']) {
      const q = parseFloat(friendly['Quantity']);
      if (!isNaN(q)) friendly['Quantity'] = q;
    }
    // clean up Date
    if (friendly['Date']) {
      const d = new Date(friendly['Date']);
      if (!isNaN(d)) friendly['Date'] = d.toISOString().slice(0, 10);
    }
    return Object.keys(friendly).length > 0 ? friendly : null;
  }

  // ── Public API ──────────────────────────────────────────────
  return {
    init() { load(); },

    // Groups
    getGroups() { return _groups; },
    getGroupNames() { return Object.keys(_groups).sort(); },
    getGroup(kd) { return _groups[kd] || []; },

    // Add row to a KD group
    addRow(kd, rawStr) {
      const parsed = parseString(rawStr);
      if (!parsed) return { ok: false, msg: 'Format data tidak dikenali.' };
      if (!_groups[kd]) _groups[kd] = [];
      const row = { _id: uid(), _kd: kd, _ts: new Date().toISOString(), ...parsed };
      _groups[kd].push(row);
      save();
      addLog('add', `Baris ditambahkan ke ${kd}`);
      return { ok: true, row };
    },

    // Add raw object (manual / import)
    addRowObj(kd, obj) {
      if (!_groups[kd]) _groups[kd] = [];
      const row = { _id: uid(), _kd: kd, _ts: new Date().toISOString(), ...obj };
      _groups[kd].push(row);
      save();
      addLog('add', `Baris manual ditambahkan ke ${kd}`);
      return { ok: true, row };
    },

    // Edit a field in a row
    editCell(kd, rowId, field, value) {
      const group = _groups[kd];
      if (!group) return false;
      const row = group.find(r => r._id === rowId);
      if (!row) return false;
      const old = row[field];
      row[field] = value;
      row._edited = new Date().toISOString();
      save();
      addLog('edit', `Edit ${field}: "${old}" → "${value}" di ${kd}`);
      return true;
    },

    // Delete a row
    deleteRow(kd, rowId) {
      if (!_groups[kd]) return false;
      const before = _groups[kd].length;
      _groups[kd] = _groups[kd].filter(r => r._id !== rowId);
      if (_groups[kd].length === before) return false;
      save();
      addLog('delete', `Hapus baris di ${kd}`);
      return true;
    },

    // Delete entire KD group
    deleteGroup(kd) {
      if (!_groups[kd]) return false;
      const count = _groups[kd].length;
      delete _groups[kd];
      save();
      addLog('delete', `Hapus grup ${kd} (${count} baris)`);
      return true;
    },

    // Rename KD group
    renameGroup(oldKd, newKd) {
      if (!_groups[oldKd] || _groups[newKd]) return false;
      _groups[newKd] = _groups[oldKd].map(r => ({ ...r, _kd: newKd }));
      delete _groups[oldKd];
      save();
      addLog('edit', `Rename grup ${oldKd} → ${newKd}`);
      return true;
    },

    // All rows flat
    getAllRows() {
      return Object.values(_groups).flat();
    },

    // Stats
    getStats() {
      const groups = Object.keys(_groups);
      const rows = this.getAllRows();
      return {
        totalGroups: groups.length,
        totalRows: rows.length,
        lastActivity: _log[0] || null,
      };
    },

    // Activity log
    getLog() { return [..._log]; },

    // Settings
    getSetting(k) { return _settings[k]; },
    setSetting(k, v) { _settings[k] = v; saveSettings(); },

    // Parse utility exposed
    parseString,

    // Export all data as JSON string
    exportJSON() { return JSON.stringify(_groups, null, 2); },

    // Import from JSON string
    importJSON(str) {
      try {
        const parsed = JSON.parse(str);
        if (typeof parsed !== 'object') return false;
        _groups = parsed;
        save();
        addLog('import', 'Data diimport dari file JSON');
        return true;
      } catch { return false; }
    },

    // Clear all
    clearAll() {
      _groups = {};
      save();
      addLog('delete', 'Semua data dihapus');
    },

    // Get all unique field names across all rows
    getAllFields() {
      const skip = new Set(['_id', '_kd', '_ts', '_edited']);
      const fields = new Set();
      Object.values(_groups).flat().forEach(row => {
        Object.keys(row).forEach(k => { if (!skip.has(k)) fields.add(k); });
      });
      return [...fields];
    },
  };
})();
