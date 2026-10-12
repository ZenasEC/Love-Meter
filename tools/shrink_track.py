"""
Shrinks a big source WAV into the small mono WAV the page ships.

    python tools/shrink_track.py "Pastel Skies - Dreamy Cover.wav" assets/pastel-skies.wav

It downmixes to mono and resamples to 32 kHz with a band-limited FFT resample
(the spectrum is truncated at the new Nyquist, so nothing aliases), then
normalises to just under full scale. A 34 MB / 48 kHz stereo source lands at
~10.7 MB / 32 kHz mono -- the file `index.html` actually loads.

This is the one tool here that needs numpy; the music generators
(`make_lofi_love.py`, `make_cupid_loop.py`) are pure standard library. It is a
one-off utility -- `assets/pastel-skies.wav` was produced with it.
"""

import os
import sys
import wave

import numpy as np

OUT_SR = 32000       # the sample rate the site ships
CEILING = 0.98       # headroom below full scale


def shrink(src, dst):
    with wave.open(src, "rb") as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    if sw != 2:
        raise SystemExit("expected 16-bit PCM, got %d-bit" % (sw * 8))

    a = np.frombuffer(raw, dtype="<i2").reshape(-1, ch).astype(np.float64) / 32768.0
    mono = a.mean(axis=1)                      # downmix to mono

    # Band-limited resample sr -> OUT_SR by truncating the spectrum.
    N = mono.size
    M = int(round(N * OUT_SR / sr))
    X = np.fft.rfft(mono)
    Y = np.zeros(M // 2 + 1, dtype=np.complex128)
    k = min(Y.size, X.size)
    Y[:k] = X[:k]
    y = np.fft.irfft(Y, n=M) * (M / N)         # undo numpy's 1/M normalisation

    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > 0:
        y *= CEILING / peak

    out = np.clip(y * 32767.0, -32768, 32767).astype("<i2")
    with wave.open(dst, "wb") as o:
        o.setnchannels(1)
        o.setsampwidth(2)
        o.setframerate(OUT_SR)
        o.writeframes(out.tobytes())

    print("read  %s  (%d Hz, %d ch, %.2fs)" % (src, sr, ch, n / sr))
    print("wrote %s  (%d Hz mono, %.2fs, %.2f MB)"
          % (dst, OUT_SR, M / OUT_SR, os.path.getsize(dst) / 1048576.0))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: python tools/shrink_track.py <source.wav> <output.wav>")
    shrink(sys.argv[1], sys.argv[2])
