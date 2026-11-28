import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DreamWorld, type SceneAudit, type WorldOptions } from '../scene/DreamWorld';

export interface WorldHandle {
  capture: () => string | undefined;
  reset: () => void;
  zoom: (amount: number) => void;
  audit: () => SceneAudit | undefined;
}

interface Props extends WorldOptions {
  onStatus: (status: 'ready' | 'preview') => void;
}

export const World = forwardRef<WorldHandle, Props>(function World(props, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<DreamWorld | null>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    capture: () => engine.current?.capture(),
    reset: () => engine.current?.reset(),
    zoom: (amount) => engine.current?.zoomBy(amount),
    audit: () => engine.current?.audit(),
  }), []);

  useEffect(() => {
    if (!mount.current) return;
    let alive = true;
    try {
      engine.current = new DreamWorld(mount.current, latest.current, () => {
        if (!alive) return;
        setReady(true);
        latest.current.onStatus('ready');
      }, () => {
        if (!alive) return;
        latest.current.onStatus('preview');
      });
    } catch (error) {
      console.error(error);
      latest.current.onStatus('preview');
    }
    return () => {
      alive = false;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setOptions(props);
  }, [props.view, props.paused, props.petals, props.quality, props.sunAzimuth, props.sunElevation, props.study]);

  return (
    <div className="world" aria-label="Aetheria modeled dreamscape">
      <div className={`world-preview ${ready ? 'world-preview-hidden' : ''}`} aria-hidden="true" />
      <div ref={mount} className={`webgl-mount ${ready ? 'is-ready' : ''}`} />
    </div>
  );
});
