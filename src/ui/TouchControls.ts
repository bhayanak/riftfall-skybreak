import type { Input } from '../core/Input';

/**
 * Floating virtual joystick (left) + action buttons (right). Feeds Input; shown only on touch devices.
 * The stick appears where the thumb lands anywhere in the lower-left zone, and it is run-biased: half a
 * thumb-width of deflection already means full sprint, so you never end up jogging by accident.
 */
export class TouchControls {
  private root = document.getElementById('touch')!;
  private zone = document.getElementById('stick-zone')!;
  private stick = document.getElementById('stick')!;
  private knob = document.getElementById('stick-knob')!;
  private stickId: number | null = null;
  private center = { x: 0, y: 0 };
  private radius = 44;
  private home = { left: '', bottom: '' };
  private vec = { x: 0, y: 0 };

  constructor(private input: Input) {
    this.root.hidden = false;
    const cs = getComputedStyle(this.stick);
    this.home = { left: cs.left, bottom: cs.bottom };

    this.zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      const t = e.changedTouches[0];
      this.stickId = t.identifier;
      // move the stick under the thumb; full deflection is a short travel so the thumb barely has to move
      const r = this.stick.getBoundingClientRect();
      this.radius = Math.max(36, r.width * 0.32);
      this.center = { x: t.clientX, y: t.clientY };
      this.stick.style.left = `${t.clientX - r.width / 2}px`;
      this.stick.style.bottom = `${innerHeight - t.clientY - r.height / 2}px`;
      this.stick.classList.remove('idle');
      this.track(t.clientX, t.clientY);
    }, { passive: false });
    this.zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.stickId) this.track(t.clientX, t.clientY);
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.stickId) this.reset();
    };
    this.zone.addEventListener('touchend', end);
    this.zone.addEventListener('touchcancel', end);

    this.bindButton('btn-jump', 'jump');
    this.bindButton('btn-dash', 'dash');
    this.bindButton('btn-grapple', 'grapple');
    this.bindButton('btn-slide', 'slide');
  }

  private bindButton(id: string, action: 'jump' | 'dash' | 'grapple' | 'slide'): void {
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
    // small dead zone, then full run by ~55 % deflection (direction stays analogue)
    const mag = Math.min(1, len / this.radius);
    const k = mag < 0.1 ? 0 : Math.min(1, (mag - 0.1) / 0.45);
    const nl = len || 1;
    this.vec.x = (dx / nl) * k;
    this.vec.y = (-dy / nl) * k;
    this.input.setTouchMove(this.vec.x, this.vec.y);
  }

  private reset(): void {
    this.stickId = null;
    this.vec.x = this.vec.y = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.stick.style.left = this.home.left;
    this.stick.style.bottom = this.home.bottom;
    this.stick.classList.add('idle');
    this.input.setTouchMove(0, 0);
  }
}
