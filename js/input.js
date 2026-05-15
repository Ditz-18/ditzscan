// input.js — Input & Camera Scan (ZXing @zxing/browser bundled lokal)
const InputManager = (() => {
  let _reader   = null;
  let _controls = null;
  let _onSubmit = null;

  // ── Submit input string ─────────────────────────────────────
  function submit() {
    const ta = document.getElementById('main-input');
    if (!ta) return;
    const raw = ta.value.trim();
    if (!raw) { Toast.show('Input kosong.', 'warning'); return; }

    const kd = KDPicker.getKD();
    const result = Data.addRow(kd, raw);
    if (!result.ok) { Toast.show(result.msg, 'danger'); return; }

    ta.value = '';
    ta.style.height = '';
    Toast.show(`Data ditambahkan ke ${kd}`, 'success');
    if (_onSubmit) _onSubmit(kd, result.row);
  }

  // ── Auto-resize textarea ────────────────────────────────────
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  // ── Set status label ────────────────────────────────────────
  function setStatus(state, msg) {
    const el = document.getElementById('scan-status');
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = state;
  }

  // ── Buka kamera & scan ──────────────────────────────────────
  async function openCamera() {
    const modal = document.getElementById('camera-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setStatus('loading', 'Mempersiapkan kamera...');

    // ZXing harus sudah ada (dimuat via <script> di HTML)
    if (!window.ZXingBrowser || !window.ZXingBrowser.BrowserMultiFormatReader) {
      setStatus('error', 'Library scanner tidak termuat. Coba reload.');
      Toast.show('ZXing tidak tersedia.', 'danger');
      return;
    }

    try {
      _reader = new window.ZXingBrowser.BrowserMultiFormatReader();

      const video = document.getElementById('camera-preview');
      if (!video) return;

      setStatus('scanning', 'Scan aktif — arahkan ke barcode / QR code');

      // decodeFromConstraints: scan terus-menerus sampai berhasil
      _controls = await _reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          }
        },
        video,
        (result, err, controls) => {
          if (result) {
            onDetected(result.getText(), controls);
          }
          // err = NotFoundException tiap frame tidak ada barcode — diabaikan
        }
      );

    } catch (err) {
      setStatus('error', 'Kamera tidak dapat diakses.');
      Toast.show('Error kamera: ' + (err.message || err), 'danger');
      closeCamera();
    }
  }

  // ── Deteksi berhasil ────────────────────────────────────────
  function onDetected(text, controls) {
    if (controls) controls.stop();
    _controls = null;

    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);

    const ta = document.getElementById('main-input');
    if (ta) {
      ta.value = text;
      autoResize(ta);
      ta.style.borderColor = 'var(--success)';
      setTimeout(() => { ta.style.borderColor = ''; }, 2000);
    }

    setStatus('success', 'Berhasil terdeteksi!');
    closeCamera();
    Toast.show('Terdeteksi! Klik "Tambah Data" untuk menyimpan.', 'success');
    setTimeout(() => { if (ta) ta.focus(); }, 300);
  }

  // ── Tutup kamera ────────────────────────────────────────────
  function closeCamera() {
    if (_controls) { try { _controls.stop(); } catch(e){} _controls = null; }
    if (_reader)   { try { _reader.reset();  } catch(e){} _reader   = null; }

    const video = document.getElementById('camera-preview');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }

    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.add('hidden');
    setStatus('idle', '');
  }

  // ── Paste & keyboard shortcut ───────────────────────────────
  function initInput() {
    const ta = document.getElementById('main-input');
    if (!ta) return;
    ta.addEventListener('paste', () => {
      setTimeout(() => {
        if (ta.value.includes(';') && ta.value.includes(':')) {
          ta.style.borderColor = 'var(--accent)';
          setTimeout(() => { ta.style.borderColor = ''; }, 1500);
        }
        autoResize(ta);
      }, 50);
    });
    ta.addEventListener('input', () => autoResize(ta));
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  return {
    init(onSubmitCb) {
      _onSubmit = onSubmitCb;
      initInput();
      document.getElementById('btn-input-submit')?.addEventListener('click', submit);
      document.getElementById('btn-input-clear')?.addEventListener('click', () => {
        const ta = document.getElementById('main-input');
        if (ta) { ta.value = ''; ta.style.height = ''; ta.focus(); }
      });
      document.getElementById('btn-scan')?.addEventListener('click', openCamera);
    },
    submit,
    openCamera,
    closeCamera,
  };
})();