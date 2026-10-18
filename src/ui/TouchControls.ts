import type { Input } from '../core/Input';

/** Virtual joystick (left) + action buttons (right). Feeds Input; shown only on touch devices. */
export class TouchControls {
  private root = document.getElementById('touch')!;
  private stick = document.getElementById('stick')!;
  private knob = document.getElementById('stick-knob')!;
  private stickId: number | null = null;
  private center = { x: 0, y: 0 };
  private radius = 60;
  private vec = { x: 0, y: 0 };

  constructor(private input: Input) {
    this.root.hidden = false;

    this.stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      const t = e.changedTouches[0];
      this.stickId = t.identifier;
      const r = this.stick.getBoundingClientRect();
      this.center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.radius = r.width * 0.38;
      this.track(t.clientX, t.clientY);
    }, { passive: false });
    this.stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.stickId) this.track(t.clientX, t.clientY);
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.stickId) this.reset();
    };
    this.stick.addEventListener('touchend', end);
    this.stick.addEventListener('touchcancel', end);

    this.bindButton('btn-jump', 'jump');
    this.bindButton('btn-dash', 'dash');
    this.bindButton('btn-grapple', 'grapple');
  }

  private bindButton(id: string, action: 'jump' | 'dash' | 'grapple'): void {
    const el = document.getElementById(id)!;
    const down = (e: Event) => { e.preventDefault(); el.classList.add('down'); this.input.setTouchAction(action, true); };
    const up = (e: Event) => { e.preventDefault(); el.classList.remove('down'); this.input.setTouchAction(action, false); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private track(x: number, y: number): void {
    let dx = x - this.center.x, dy = y - this.center.y;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) { dx *= this.radius / len; dy *= this.radius / len; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // dead zone then full range
    const mag = Math.min(1, len / this.radius);
    const k = mag < 0.12 ? 0 : (mag - 0.12) / 0.88;
    const nl = len || 1;
    this.vec.x = (dx / nl) * k;
    this.vec.y = (-dy / nl) * k;
    this.input.setTouchMove(this.vec.x, this.vec.y);
  }

  private reset(): void {
    this.stickId = null;
    this.vec.x = this.vec.y = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.input.setTouchMove(0, 0);
  }
}
