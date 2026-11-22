# The values test.js holds lufs, lra and truepeak to, from the references themselves, of the sounds signals.js writes:
#   node test/signals.js <dir> && python test/references.py <dir> > test/references.json
# pip install pyebur128==0.1.1 numpy scipy  (pyebur128: github.com/jodhus/pyebur128, MIT, built on libebur128 1.2.6)
#
#   lufs         libebur128's integrated loudness (ITU-R BS.1770-4)
#   lra          EBU Tech 3342 (2023) section 5, its MATLAB function line for line, over libebur128's short-term
#                loudness read each 100 ms: section 3.1 requires the 3 s windows at least 2.9 s overlapped
#   lraSecond    libebur128's own loudness range, its windows a second apart (the 2 s overlap of Tech 3342 before 2023)
#   truepeak     the largest magnitude of the waveform read 32 points a sample through a Kaiser-windowed sinc
#                (beta 14, 128 samples long: 4097 taps), silence outside the signal, in dBTP
#   truepeakLib  libebur128's true peak (4 points a sample under 96 kHz, 2 from there), in dBTP
import sys, os, glob, json, math, platform
from importlib.metadata import version
import numpy as np
from scipy.io import wavfile
from scipy.signal import firwin, upfirdn
import pyebur128 as ebur

assert version('pyebur128') == '0.1.1' and ebur.get_libebur128_version() == '1.2.6', 'libebur128 1.2.6 is the reference'
UP = 32
KERNEL = firwin(UP * 128 + 1, 1 / UP, window=('kaiser', 14)) * UP

def loudness_range(short_term):
    """Tech 3342 section 5, LoudnessRange(ShortTermLoudness); MATLAB's round is half away from zero, its indices from 1"""
    stl = np.asarray(short_term)
    stl_absgated = stl[stl >= -70]
    n = len(stl_absgated)
    stl_integrated = 10 * math.log10(np.sum(10 ** (stl_absgated / 10)) / n)
    stl_sorted = np.sort(stl_absgated[stl_absgated >= stl_integrated - 20])
    n = len(stl_sorted)
    at = lambda prc: stl_sorted[math.floor((n - 1) * prc / 100 + 1 + 0.5) - 1]
    return at(95) - at(10)

def measure(x, fs):
    nch, hop = x.shape[1], (fs + 5) // 10  # libebur128's own 100 ms
    mode = ebur.MeasurementMode.MODE_I | ebur.MeasurementMode.MODE_LRA | ebur.MeasurementMode.MODE_TRUE_PEAK
    state, short_term = ebur.R128State(nch, fs, mode), []
    for k in range(len(x) // hop):
        state.add_frames(np.ascontiguousarray(x[k * hop:(k + 1) * hop]).reshape(-1), hop)
        if k >= 29: short_term.append(ebur.get_loudness_shortterm(state))
    rest = x[len(x) // hop * hop:]
    if len(rest): state.add_frames(np.ascontiguousarray(rest).reshape(-1), len(rest))
    db = lambda peak: 20 * math.log10(peak)
    return {
        'lufs': ebur.get_loudness_global(state),
        'lra': float(loudness_range(short_term)),
        'lraSecond': ebur.get_loudness_range(state),
        'truepeak': db(max(np.abs(upfirdn(KERNEL, x[:, c].astype(np.float64), up=UP)).max() for c in range(nch))),
        'truepeakLib': db(max(ebur.get_true_peak(state, c) for c in range(nch))),
    }

cases = {}
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.wav'))):
    fs, x = wavfile.read(f)
    assert x.dtype == np.float32
    cases[os.path.basename(f)[:-len('.wav')]] = measure(x.reshape(len(x), -1), fs)

head = {'made': 'node test/signals.js <dir> && python test/references.py <dir> > test/references.json',
        'libebur128': '1.2.6 (pyebur128 0.1.1)', 'numpy': np.__version__, 'scipy': version('scipy'), 'python': platform.python_version()}
print('{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v)}' for k, v in head.items()) + ',\n  "cases": {\n' +
      ',\n'.join(f'    {json.dumps(k)}: {json.dumps(v)}' for k, v in cases.items()) + '\n  }\n}')
