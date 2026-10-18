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
    this.show('RIFT BREACHED', `${biomeName} AHEAD · ENERGY ${energy}`, 'PICK ONE · PRESS 1 / 2 / 3 OR CLICK');
    this.cards.innerHTML = '';
    this.hovered = 0;
    options.forEach((u, i) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${u.icon}</span><span class="name">${u.name}</span><span class="desc">${u.desc}</span><span class="why">${u.why}</span>`;
      el.addEventListener('click', () => this.pick(i));
      el.addEventListener('pointerenter', () => this.setHover(i));
      this.cards.appendChild(el);
    });
    this.setHover(0);
    return new Promise((res) => { this.resolver = res; });
  }

  /** Controls card. Resolves on any pick (Space / click / tap). */
  howToPlay(touch: boolean): Promise<number> {
    this.show('RIFTFALL', 'HOW TO PLAY', touch ? 'TAP TO START' : 'PRESS SPACE TO START · H ANYTIME FOR THIS CARD');
    this.cards.innerHTML = '';
    const rows: [string, string, string][] = touch
      ? [['◉', 'MOVE', 'Left stick. Drag right side to look.'], ['JUMP', 'JUMP ×2', 'Tap again in the air for a second jump.'],
         ['DASH', 'AIR DASH', 'Tap mid-jump to cross big gaps.'], ['GRAPPLE', 'GRAPPLE', 'When a ring glows gold, tap to swing. Tap again to let go.'],
         ['WALL', 'WALL-RUN', 'Jump towards a wall while moving. Jump again to leap off.'], ['SLIDE', 'SLIDE', 'Slide while sprinting for a burst of speed.'],
         ['▲', 'THE RIFT', 'It chases you. Keep moving forward. Reach the portal.']]
      : [['WASD', 'MOVE', 'Mouse to look (click once to capture).'], ['SPACE', 'JUMP ×2', 'Press again in the air for a second jump.'],
         ['SHIFT', 'AIR DASH', 'Press mid-jump to cross big gaps.'], ['E', 'GRAPPLE', 'When a ring glows gold, press E to swing. E again to let go.'],
         ['SPACE', 'WALL-RUN', 'Jump towards a wall while moving. Space again to leap off.'], ['C', 'SLIDE', 'Slide while sprinting for a burst of speed.'],
         ['▲', 'THE RIFT', 'It chases you. Keep moving forward. Reach the portal.']];
    const list = document.createElement('div');
    list.className = 'howto';
    for (const [key, name, text] of rows) {
      const r = document.createElement('div');
      r.className = 'row';
      r.innerHTML = `<kbd>${key}</kbd><b>${name}</b><span>${text}</span>`;
      list.appendChild(r);
    }
    this.cards.appendChild(list);
    const go = document.createElement('button');
    go.className = 'card single';
    go.innerHTML = `<span class="icon">▶</span><span class="name">RUN</span>`;
    go.addEventListener('click', () => this.pick(0));
    this.cards.appendChild(go);
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
