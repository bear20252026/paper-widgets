import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioRoom { context: AudioContext; master: GainNode; breeze: AudioBufferSourceNode; timer: number }

function note(ctx: AudioContext, destination: AudioNode, hz: number, at: number, length: number, level: number, type: OscillatorType = 'sine', endHz = hz) {
  const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(hz, at); oscillator.frequency.exponentialRampToValueAtTime(endHz, at + length);
  envelope.gain.setValueAtTime(.00001, at); envelope.gain.exponentialRampToValueAtTime(level, at + Math.min(.09, length / 5)); envelope.gain.exponentialRampToValueAtTime(.00001, at + length);
  oscillator.connect(envelope); envelope.connect(destination); oscillator.start(at); oscillator.stop(at + length + .05);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

export function useAtmosphereAudio() {
  const room = useRef<AudioRoom | null>(null);
  const [enabled, setEnabled] = useState(false);
  const playing = useRef(false);

  const prepare = useCallback(async () => {
    if (!room.current) {
      if (typeof AudioContext === 'undefined') throw new Error('Audio is not supported in this browser.');
      const context = new AudioContext(), master = context.createGain();
      master.gain.value = 0; master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const samples = buffer.getChannelData(0); let previous = 0;
      for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .035) / 1.035; samples[i] = previous * .8; }
      const breeze = context.createBufferSource(), filter = context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 720;
      breeze.buffer = buffer; breeze.loop = true; breeze.connect(filter); filter.connect(master); breeze.start();
      const phrase = [293.66, 440, 369.99, 329.63, 493.88, 440, 369.99, 293.66]; let step = 0;
      const timer = window.setInterval(() => {
        if (!playing.current || context.state !== 'running' || document.hidden) return;
        const hz = phrase[step % phrase.length];
        note(context, master, hz, context.currentTime, 3.3, .035);
        note(context, master, hz * 2, context.currentTime + .02, 1.4, .008);
        if (step % 4 === 0) note(context, master, hz / 2, context.currentTime + .3, 5, .025);
        step++;
      }, 2900);
      room.current = { context, master, breeze, timer };
    }
    await room.current.context.resume();
    return room.current;
  }, []);

  const setSound = useCallback(async (on: boolean) => {
    if (!on && !room.current) return;
    const audio = await prepare();
    playing.current = on; setEnabled(on);
    audio.master.gain.cancelScheduledValues(audio.context.currentTime);
    audio.master.gain.setTargetAtTime(on ? .46 : 0, audio.context.currentTime, .17);
    if (on) { note(audio.context, audio.master, 587.33, audio.context.currentTime, 2.6, .025); note(audio.context, audio.master, 440, audio.context.currentTime + .5, 3.1, .03); }
  }, [prepare]);

  const chime = useCallback(() => {
    const audio = room.current; if (!playing.current || !audio) return;
    [587.33, 739.99, 880].forEach((hz, i) => note(audio.context, audio.master, hz, audio.context.currentTime + i * .12, 1.5, .035));
  }, []);

  const owlCall = useCallback(async () => {
    const audio = await prepare();
    if (!playing.current) await setSound(true);
    const now = audio.context.currentTime;
    note(audio.context, audio.master, 530, now + .08, .3, .14, 'sine', 445);
    note(audio.context, audio.master, 470, now + .52, .6, .17, 'sine', 370);
    note(audio.context, audio.master, 935, now + .54, .45, .025, 'sine', 750);
  }, [prepare, setSound]);

  useEffect(() => {
    const visibility = () => {
      const audio = room.current; if (!audio) return;
      if (document.hidden) void audio.context.suspend();
      else if (playing.current) void audio.context.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); if (room.current) { window.clearInterval(room.current.timer); room.current.breeze.stop(); void room.current.context.close(); room.current = null; } };
  }, []);
  return { enabled, setSound, chime, owlCall };
}