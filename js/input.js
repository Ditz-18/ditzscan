// input.js — Input & Camera Scan Logic (ZXing barcode decoder)
const InputManager = (() => {
  let _stream    = null;
  let _scanning  = false;
  let _reader    = null;
  let _rafId     = null;
  let _onSubmit  = null;
  let _zxingReady = false;

  // ── Load ZXing dari CDN ─────────────────────────────────────
  function loadZXing() {
    return new Promise((resolve) => {
      if (window.ZXing) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.1/zxing.min.js';
      script.onload  = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

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

  // ── Buka kamera + mulai scan ────────────────────────────────
  async function openCamera() {
    const modal = document.getElementById('camera-modal');
    if (!modal) return;

    setScanStatus('loading', 'Memuat decoder barcode...');
    modal.classList.remove('hidden');

    // Load ZXing
    const ok = await loadZXing();
    if (!ok || !window.ZXing) {
      setScanStatus('error', 'Gagal memuat library decoder.');
      Toast.show('Gagal memuat ZXing. Cek koneksi internet.', 'danger');
      return;
    }
    _zxingReady = true;

    // Buka kamera
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        }
      });
      const video = document.getElementById('camera-preview');
      if (!video) return;
      video.srcObject = _stream;
      await video.play();

      setScanStatus('scanning', 'Scan aktif — arahkan ke barcode / QR code');
      _scanning = true;
      startDecodeLoop(video);
    } catch (err) {
      setScanStatus('error', 'Kamera tidak dapat diakses.');
      Toast.show('Kamera error: ' + err.message, 'danger');
      closeCamera();
    }
  }

  // ── Decode loop menggunakan ZXing ───────────────────────────
  function startDecodeLoop(video) {
    if (!window.ZXing) return;

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.DATA_MATRIX,
      ZXing.BarcodeFormat.PDF_417,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.ITF,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    _reader = new ZXing.BrowserMultiFormatReader(hints);

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (!_scanning || !_stream) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const lum  = new ZXing.RGBLuminanceSource(imgData.data, canvas.width, canvas.height);
          const bin  = new ZXing.HybridBinarizer(lum);
          const bmp  = new ZXing.BinaryBitmap(bin);
          const res  = _reader.decode(bmp);

          if (res && res.getText()) {
            onDetected(res.getText());
            return; // stop loop setelah berhasil
          }
        } catch (e) {
          // NotFoundException biasa → lanjut
        }
      }

      _rafId = requestAnimationFrame(tick);
    }

    _rafId = requestAnimationFrame(tick);
  }

  // ── Hasil deteksi ───────────────────────────────────────────
  function onDetected(text) {
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);

    const ta = document.getElementById('main-input');
    if (ta) {
      ta.value = text;
      autoResize(ta);
      ta.style.borderColor = 'var(--success)';
      setTimeout(() => { ta.style.borderColor = ''; }, 2000);
    }

    setScanStatus('success', 'Berhasil terdeteksi!');
    closeCamera();
    Toast.show('Barcode terdeteksi! Klik "Tambah Data" untuk menyimpan.', 'success');
    setTimeout(() => { if (ta) ta.focus(); }, 300);
  }

  // ── Tutup kamera ────────────────────────────────────────────
  function closeCamera() {
    _scanning = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_reader) { try { _reader.reset(); } catch(e){} _reader = null; }
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.add('hidden');
    const video = document.getElementById('camera-preview');
    if (video) video.srcObject = null;
    setScanStatus('idle', '');
  }

  // ── Status label ────────────────────────────────────────────
  function setScanStatus(state, msg) {
    const el = document.getElementById('scan-status');
    if (!el) return;
    el.textContent = msg;
    el.dataset.state = state;
  }

  // ── Paste & input listener ──────────────────────────────────
  function initPaste() {
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
      initPaste();
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