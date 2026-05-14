// export.js — Export XLS & PDF
const Exporter = (() => {
  const COLS = [
    'Vendor','PO Number','Date','Quantity','Material',
    'Batch/Box','Serial Number','Storage Loc','Customer',
    'Delivery Type','Destination','Pallet','Plant','Z Value'
  ];

  // ── Export XLS (CSV-based, opens in Excel) ──────────────────
  function exportXLS(kdFilter) {
    const groups = Data.getGroups();
    const names = kdFilter
      ? [kdFilter]
      : Data.getGroupNames();

    if (names.length === 0) { Toast.show('Tidak ada data untuk diekspor.', 'warning'); return; }

    const rows = [];
    // Header
    rows.push(['KD', ...COLS]);

    names.forEach(kd => {
      const group = groups[kd] || [];
      if (group.length === 0) return;
      group.forEach(row => {
        rows.push([kd, ...COLS.map(c => row[c] ?? '')]);
      });
    });

    const csv = rows.map(r =>
      r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')
    ).join('\r\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    download(blob, `DITZ_SCAN_${timestamp()}.csv`);
    Toast.show('Export XLS berhasil.', 'success');
  }

  // ── Export PDF (print stylesheet) ──────────────────────────
  function exportPDF(kdFilter) {
    const groups = Data.getGroups();
    const names = kdFilter
      ? [kdFilter]
      : Data.getGroupNames();

    if (names.length === 0) { Toast.show('Tidak ada data untuk diekspor.', 'warning'); return; }

    let html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>DITZ SCAN Export</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
        h2 { font-size: 13px; background: #1a3a5c; color: white;
             padding: 6px 10px; margin: 16px 0 0; border-radius: 4px 4px 0 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 0; page-break-inside: auto; }
        thead th {
          background: #e8f0fe; border: 1px solid #ccc;
          padding: 5px 6px; text-align: left; font-size: 9px;
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        tbody td { border: 1px solid #ddd; padding: 4px 6px; font-size: 10px; }
        tbody tr:nth-child(even) { background: #f5f9ff; }
        .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
        @page { margin: 15mm; }
      </style>
    </head><body>
      <h1>DITZ SCAN</h1>
      <div class="meta">Dicetak oleh: Adit &nbsp;|&nbsp; ${new Date().toLocaleString('id-ID')}</div>`;

    names.forEach(kd => {
      const group = groups[kd] || [];
      html += `<h2>${kd} (${group.length} baris)</h2>
        <table>
          <thead><tr>
            <th>#</th>${COLS.map(c => `<th>${c}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${group.map((row, i) => `<tr>
              <td>${i+1}</td>
              ${COLS.map(c => `<td>${row[c] ?? ''}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>`;
    });

    html += `<div class="footer">DITZ SCAN &mdash; Generated ${new Date().toISOString()}</div>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { Toast.show('Popup diblokir browser. Izinkan popup.', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    Toast.show('Jendela cetak PDF dibuka.', 'success');
  }

  // ── Export JSON backup ──────────────────────────────────────
  function exportJSON() {
    const blob = new Blob([Data.exportJSON()], { type: 'application/json' });
    download(blob, `DITZ_SCAN_backup_${timestamp()}.json`);
    Toast.show('Backup JSON berhasil.', 'success');
  }

  // ── Import JSON ─────────────────────────────────────────────
  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const ok = Data.importJSON(ev.target.result);
        if (ok) {
          TableManager.renderAll();
          Toast.show('Data berhasil diimport.', 'success');
        } else {
          Toast.show('Format file tidak valid.', 'danger');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Helpers ─────────────────────────────────────────────────
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function timestamp() {
    return new Date().toISOString().slice(0,16).replace('T','_').replace(':','');
  }

  return { exportXLS, exportPDF, exportJSON, importJSON };
})();
