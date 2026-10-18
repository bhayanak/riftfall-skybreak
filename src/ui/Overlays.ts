import type { Upgrade } from '../progression/Upgrade';

/** DOM overlays: upgrade choice, run over, loading. */
export class Overlays {
  private root = document.getElementById('overlay')!;
  private title = document.getElementById('ov-title')!;
  private sub = document.getElementById('ov-sub')!;
  private cards = document.getElementById('ov-cards')!;
  private foot = document.getElementById('ov-foot')!;
  private resolver: ((i: number) => void) | null = null;
  private hovered = 0;

  get visible(): boolean { return !this.root.hidden; }

  loading(progress01: number): void {
    this.show('RIFTFALL', 'SKYBREAK', `LOADING ${Math.round(progress01 * 100)}%`);
    this.cards.innerHTML = '';
    this.resolver = null;
  }

  hide(): void { this.root.hidden = true; this.resolver = null; }

  /** Resolves with the chosen index. Keyboard 1/2/3 handled by caller via pick(i). */
  chooseUpgrade(biomeName: string, energy: number, options: Upgrade[]): Promise<number> {
    this.show('RIFT BREACHED', `${biomeName} AHEAD · ENERGY ${energy}`, 'CHOOSE ONE · 1 / 2 / 3');
    this.cards.innerHTML = '';
    this.hovered = 0;
    options.forEach((u, i) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${u.icon}</span><span class="name">${u.name}</span><span class="desc">${u.desc}</span>`;
      el.addEventListener('click', () => this.pick(i));
      el.addEventListener('pointerenter', () => this.setHover(i));
      this.cards.appendChild(el);
    });
    this.setHover(0);
    return new Promise((res) => { this.resolver = res; });
  }

  runOver(reason: string, energy: number, best: number, distance: number): Promise<number> {
    this.show('THE RIFT TOOK YOU', reason, `ENERGY ${energy} · BEST FLOW x${best} · ${Math.round(distance)} m`);
    this.cards.innerHTML = '';
    const el = document.createElement('button');
    el.className = 'card single';
    el.innerHTML = `<span class="icon">↻</span><span class="name">RUN AGAIN</span><span class="desc">SPACE / TAP</span>`;
    el.addEventListener('click', () => this.pick(0));
    this.cards.appendChild(el);
    return new Promise((res) => { this.resolver = res; });
  }

  pick(i: number): void {
    const r = this.resolver;
    if (!r) return;
    if (i >= this.cards.children.length) return;
    this.resolver = null;
    this.hide();
    r(i);
  }

  setHover(i: number): void {
    this.hovered = i;
    Array.from(this.cards.children).forEach((c, k) => c.classList.toggle('hover', k === i));
  }
  get hover(): number { return this.hovered; }

  private show(title: string, sub: string, foot: string): void {
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.foot.textContent = foot;
    this.root.hidden = false;
  }
}
