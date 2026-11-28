export type AudioSelection = { release: number; track: number; radio: boolean };

// A small, original generative listening sketch keeps previews self-contained.
export class ArchiveAudio {
  private context: AudioContext | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private master: GainNode | null = null;
  private generation = 0;

  async play(release: number, track: number) {
    this.stop();
    const generation = this.generation;
    if (!this.context) this.context = new AudioContext();
    await this.context.resume();
    if (generation !== this.generation || !this.context) return false;
    const ctx = this.context;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.17, now + 1.4);
    master.connect(ctx.destination);
    this.master = master;

    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.72;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.36;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    const root = [130.81, 146.83, 110, 164.81, 123.47][(release + track) % 5];

    [1, 1.4983, 2, 2.3784, 2.9966].forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = root * ratio;
      osc.detune.value = index % 2 ? -5 : 4;
      const gain = ctx.createGain();
      gain.gain.value = index < 3 ? 0.17 : 0.055;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + index * 0.027;
      const depth = ctx.createGain();
      depth.gain.value = 0.033;
      lfo.connect(depth);
      depth.connect(gain.gain);
      osc.connect(gain);
      gain.connect(master);
      gain.connect(delay);
      osc.start(now);
      lfo.start(now);
      this.nodes.push(osc, lfo);
    });

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = (previous + Math.random() * 0.04 - 0.02) / 1.025;
      data[i] = previous;
    }
    const rain = ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.24;
    rain.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(master);
    rain.start(now);
    this.nodes.push(rain);
    return true;
  }

  stop() {
    this.generation++;
    const oldNodes = this.nodes;
    const oldMaster = this.master;
    this.nodes = [];
    this.master = null;
    if (this.context && oldMaster) {
      const now = this.context.currentTime;
      oldMaster.gain.cancelScheduledValues(now);
      oldMaster.gain.setTargetAtTime(0, now, 0.08);
      window.setTimeout(() => {
        oldNodes.forEach((node) => {
          try {
            node.stop();
            node.disconnect();
          } catch {
            /* Already stopped. */
          }
        });
        oldMaster.disconnect();
      }, 400);
    }
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
