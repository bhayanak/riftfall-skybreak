export type Action = 'jump' | 'dash' | 'grapple' | 'slide' | 'restart' | 'debug' | 'help' | 'pause' | 'mute' | 'pick1' | 'pick2' | 'pick3' | 'pick4' | 'confirm';

const KEYS: Record<string, Action> = {
  Space: 'jump',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyE: 'grapple',
  KeyC: 'slide',
  ControlLeft: 'slide',
  KeyR: 'restart',
  KeyH: 'help',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  Backquote: 'debug',
  Digit1: 'pick1',
  Digit2: 'pick2',
  Digit3: 'pick3',
  Digit4: 'pick4',
  Enter: 'confirm',
};

/**
 * Unified input: keyboard+mouse (pointer lock) and touch (joystick/buttons fed by TouchControls).
 * `move` is in screen space (x right, y forward); callers rotate it by camera yaw.
 */
export class Input {
  readonly move = { x: 0, y: 0 };
  /** Accumulated look delta since last frame, in pixels. */
  readonly look = { x: 0, y: 0 };

  private keys = new Set<string>();
  private held = new Set<Action>();
  private pressedNow = new Set<Action>();
  private releasedNow = new Set<Action>();
  private touchMove = { x: 0, y: 0 };
  private pointerLocked = false;
  /** Browsers swallow the Esc that exits pointer lock, so losing the lock is how desktop reaches the pause menu. */
  onPointerLockLost: (() => void) | null = null;
  private lookTouchId: number | null = null;
  private lastTouch = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.clearAll());
    // inside a portal iframe the page must never scroll, zoom or pop a context menu under the game
    window.addEventListener('wheel', (e) => { if (!(e.target as Element | null)?.closest?.('#overlay')) e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === canvas;
      if (was && !this.pointerLocked) this.onPointerLockLost?.();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });

    // Right-half touch drag = look. Left half is owned by the joystick (TouchControls).
    canvas.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.lookTouchId === null && t.clientX > innerWidth * 0.5) {
          this.lookTouchId = t.identifier;
          this.lastTouch.x = t.clientX; this.lastTouch.y = t.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.lookTouchId) {
          this.look.x += (t.clientX - this.lastTouch.x) * 2.2;
          this.look.y += (t.clientY - this.lastTouch.y) * 2.2;
          this.lastTouch.x = t.clientX; this.lastTouch.y = t.clientY;
        }
      }
    }, { passive: true });
    const endTouch = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.lookTouchId) this.lookTouchId = null;
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  /** Called by TouchControls every frame. */
  setTouchMove(x: number, y: number): void { this.touchMove.x = x; this.touchMove.y = y; }
  /** Called by TouchControls on button down/up. */
  setTouchAction(action: Action, down: boolean): void { down ? this.press(action) : this.release(action); }

  isHeld(a: Action): boolean { return this.held.has(a); }
  wasPressed(a: Action): boolean { return this.pressedNow.has(a); }
  wasReleased(a: Action): boolean { return this.releasedNow.has(a); }
  get hasPointerLock(): boolean { return this.pointerLocked; }

  /** Call at the start of each frame to resolve axes; call endFrame() after game update. */
  beginFrame(): void {
    let x = 0, y = 0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    if (Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0.01) { x = this.touchMove.x; y = this.touchMove.y; }
    this.move.x = x; this.move.y = y;
  }

  endFrame(): void {
    this.pressedNow.clear();
    this.releasedNow.clear();
    this.look.x = 0; this.look.y = 0;
  }

  private press(a: Action): void {
    if (!this.held.has(a)) { this.held.add(a); this.pressedNow.add(a); }
  }
  private release(a: Action): void {
    if (this.held.has(a)) { this.held.delete(a); this.releasedNow.add(a); }
  }
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();   // no page scroll under the game
    const a = KEYS[e.code];
    if (a) this.press(a);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    const a = KEYS[e.code];
    if (a) this.release(a);
  };
  private clearAll(): void {
    this.keys.clear();
    for (const a of this.held) this.releasedNow.add(a);
    this.held.clear();
    this.touchMove.x = this.touchMove.y = 0;
  }
}
