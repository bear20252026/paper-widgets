import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SyncableViewport {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

/**
 * Bi-directionally synchronizes two OrbitControls viewports without feedback loops.
 */
export class CameraSyncManager {
  private a: SyncableViewport;
  private b: SyncableViewport;
  private enabled = true;
  private syncing = false;
  private onAChange: () => void;
  private onBChange: () => void;

  constructor(a: SyncableViewport, b: SyncableViewport, enabled = true) {
    this.a = a;
    this.b = b;
    this.enabled = enabled;

    this.onAChange = () => {
      if (!this.enabled || this.syncing) return;
      this.syncing = true;
      this.copyCamera(this.a, this.b);
      this.syncing = false;
    };

    this.onBChange = () => {
      if (!this.enabled || this.syncing) return;
      this.syncing = true;
      this.copyCamera(this.b, this.a);
      this.syncing = false;
    };

    this.a.controls.addEventListener('change', this.onAChange);
    this.b.controls.addEventListener('change', this.onBChange);
  }

  private copyCamera(src: SyncableViewport, dst: SyncableViewport): void {
    dst.camera.position.copy(src.camera.position);
    dst.camera.quaternion.copy(src.camera.quaternion);
    dst.controls.target.copy(src.controls.target);
    dst.controls.update();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.syncing = true;
      this.copyCamera(this.a, this.b);
      this.syncing = false;
    }
  }

  resetBoth(target: THREE.Vector3, position: THREE.Vector3): void {
    this.syncing = true;
    this.a.camera.position.copy(position);
    this.a.controls.target.copy(target);
    this.a.controls.update();
    this.b.camera.position.copy(position);
    this.b.controls.target.copy(target);
    this.b.controls.update();
    this.syncing = false;
  }

  dispose(): void {
    this.a.controls.removeEventListener('change', this.onAChange);
    this.b.controls.removeEventListener('change', this.onBChange);
  }
}
