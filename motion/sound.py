# Sound design for the piece, synthesised with ffmpeg's generators: no music, no voice.
# Every event's time comes from the page's own timeline (land2.html), so the sound lands
# where the picture does. Writes out/sound.m4a (69 s).
import subprocess, math, os
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out')
DUR = 69.0

layers = []   # (filter chain producing a labelled stream, label)
n = 0
def src(chain):
    global n
    n += 1
    lab = f's{n}'
    layers.append((chain + f'[{lab}]', lab))

# room: a low, slow bed that is always there (filtered brown noise, breathing)
src(f"anoisesrc=d={DUR}:c=brown:r=48000:a=0.5,lowpass=f=140,volume=0.16,tremolo=f=0.1:d=0.3")
# a faint high air, so the room is not dead
src(f"anoisesrc=d={DUR}:c=pink:r=48000:a=0.5,highpass=f=5000,lowpass=f=9000,volume=0.012")

def tick(t, vol=0.22, f=2600, dur=0.018):
    # a key press: a tiny click
    src(f"anoisesrc=d={dur}:c=white:r=48000:a=1,bandpass=f={f}:w=1800,afade=t=out:st=0:d={dur},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")

def thud(t, vol=0.5, f=62, dur=0.55):
    # a finding caught: a low hit
    src(f"sine=f={f}:d={dur}:r=48000,afade=t=in:st=0:d=0.004,afade=t=out:st=0.03:d={dur-0.03},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")

def pass_(t, vol=0.3, dur=1.1):
    # the camera crossing a layer: filtered noise swelling and falling
    src(f"anoisesrc=d={dur}:c=pink:r=48000:a=0.7,bandpass=f=900:w=1200,afade=t=in:st=0:d={dur*0.35},afade=t=out:st={dur*0.35}:d={dur*0.65},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")

def tone(t, f=880, vol=0.22, dur=1.6):
    # green: one clean note with a soft fifth
    src(f"sine=f={f}:d={dur}:r=48000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.2:d={dur-0.2},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")
    src(f"sine=f={f*1.5}:d={dur}:r=48000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.2:d={dur-0.2},volume={vol*0.35},adelay={int(t*1000+40)}|{int(t*1000+40)},apad=whole_dur={DUR}")

def buzz(t, vol=0.4, dur=0.5):
    # refused: a hard low buzz
    src(f"sine=f=55:d={dur}:r=48000,tremolo=f=28:d=0.8,afade=t=in:st=0:d=0.005,afade=t=out:st=0.1:d={dur-0.1},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")

def riser(t, dur=5.0, vol=0.2):
    # the change travelling the corridor: a slow rising sweep
    src(f"anoisesrc=d={dur}:c=pink:r=48000:a=0.6,lowpass=f=600,afade=t=in:st=0:d={dur*0.7},afade=t=out:st={dur*0.7}:d={dur*0.3},volume={vol},adelay={int(t*1000)}|{int(t*1000)},apad=whole_dur={DUR}")

# --- the timeline, from land2.html ---
# typing: "$ /land" at 16.2 (14 cps, 7 chars)
for i in range(7): tick(16.2 + i / 14, vol=0.2)
# the report rows land: a soft click each (17.3, then 17.7 + .34k)
tick(17.3, vol=0.16, f=1600, dur=0.03)
for k in range(7): tick(17.7 + k * .34, vol=0.14, f=1400 + k * 120, dur=0.03)
# the layers rising with the rows: a low pass each
for k in range(7): pass_(17.6 + k * .34, vol=0.12, dur=0.6)
# the gate goes red
thud(20.2, vol=0.55, f=58, dur=0.7); buzz(20.25, vol=0.22, dur=0.3)
# findings fly in and pin: whoosh then hit, 24.0 + 2.6 i, pinned at +1.2
for i in range(3):
    pass_(24.0 + i * 2.6, vol=0.22, dur=0.9); thud(25.2 + i * 2.6, vol=0.42, f=70 - i * 6, dur=0.5)
# the fix types itself: fast ticks 36.6 .. 40.8
t = 36.6
while t < 40.8: tick(t, vol=0.11, f=2400, dur=0.012); t += 0.045
# tests pass: a small tone
tone(41.6, f=660, vol=0.12, dur=0.8)
# round 2: "$ /land" at 44.4, rows 45.5, 45.9 + .3k (each turns a layer green)
for i in range(7): tick(44.4 + i / 14, vol=0.2)
tick(45.5, vol=0.16, f=1600, dur=0.03)
for k in range(7): tick(45.9 + k * .3, vol=0.14, f=1800 + k * 140, dur=0.03)
tone(47.9, f=523.25, vol=0.16, dur=2.2)   # the run is green (the gate turns amber)
# the change travels the corridor and passes the layers (49.5, 6 s)
riser(49.5, dur=6.0, vol=0.26)
for k in range(7): pass_(50.3 + k * .62, vol=0.16 + k * .02, dur=0.7)
# push typed 54.0 (34 cps, 41 chars), refused at 55.6
for i in range(41): tick(54.0 + i / 34, vol=0.15)
buzz(55.6, vol=0.55, dur=0.6); thud(55.6, vol=0.5, f=50, dur=0.8)
# approve typed 57.0 (58 cps, ~110 chars), approved at 59.3
for i in range(110): tick(57.0 + i / 58, vol=0.12)
tone(59.3, f=659.25, vol=0.2, dur=2.4)
# push typed 60.0 (44 cps), through at 61.5
for i in range(41): tick(60.0 + i / 44, vol=0.15)
tone(61.5, f=783.99, vol=0.24, dur=3.0); pass_(61.6, vol=0.3, dur=2.0)
# through the gate to the end: a long soft pass, then the room fades
pass_(63.8, vol=0.22, dur=3.0)

inputs = ';'.join(ch for ch, _ in layers)
mix = ''.join(f'[{lab}]' for _, lab in layers)
fc = f"{inputs};{mix}amix=inputs={len(layers)}:normalize=0:dropout_transition=0,afade=t=out:st=66.5:d=2.5,loudnorm=I=-18:TP=-1.5:LRA=12[out]"
script = os.path.join(out, 'sound-filter.txt')
open(script, 'w').write(fc)
cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-/filter_complex', script, '-map', '[out]', '-t', str(DUR), '-c:a', 'aac', '-b:a', '192k', os.path.join(out, 'sound.m4a')]
subprocess.check_call(cmd)
print('sound.m4a written with', len(layers), 'events')
