import type { Upgrade } from '../progression/Upgrade';
import type { ShopItem, ItemKind } from '../progression/Shop';

export type StartChoice = 'play' | 'daily' | 'shop' | 'howto';

/** What the shop UI needs from the game to render and act. */
export interface ShopController {
  items: ShopItem[];
  coins(): number;
  status(item: ShopItem): 'buy' | 'owned' | 'equipped';
  /** buy or equip; returns a short message for the footer */
  act(item: ShopItem): string;
}

/** DOM overlays: loading, start screen, shop, upgrade choice, run over. */
export class Overlays {
  private root = document.getElementById('overlay')!;
  private title = document.getElementById('ov-title')!;
  private sub = document.getElementById('ov-sub')!;
  private cards = document.getElementById('ov-cards')!;
  private foot = document.getElementById('ov-foot')!;
  private resolver: ((i: number) => void) | null = null;
  private hovered = 0;
  /** index picked by Space/Enter, and by Esc/H (null = ignore) */
  private primaryIndex: number | null = 0;
  private escapeIndex: number | null = null;

  get visible(): boolean { return !this.root.hidden; }

  loading(progress01: number): void {
    this.show('RIFTFALL', 'SKYBREAK', `LOADING ${Math.round(progress01 * 100)}%`);
    this.cards.innerHTML = '';
    this.resolver = null;
    this.primaryIndex = null;
  }

  hide(): void { this.root.hidden = true; this.root.classList.remove('light'); this.resolver = null; }

  /** Title screen. Resolves with the player's choice. */
  startScreen(o: { coins: number; best: string; daily: boolean; touch: boolean }): Promise<StartChoice> {
    this.show('RIFTFALL', 'SKYBREAK', `◎ ${o.coins.toLocaleString()} COINS · ${o.best}`, true);
    this.cards.innerHTML = '';
    const defs: { key: string; icon: string; name: string; desc: string; choice: StartChoice }[] = [
      { key: o.touch ? '' : 'SPACE', icon: '▶', name: 'RUN', desc: o.daily ? 'Daily route — same for everyone today' : 'New seeded route', choice: 'play' },
      { key: o.touch ? '' : '2', icon: '☀', name: o.daily ? 'DAILY: ON' : 'DAILY: OFF', desc: 'Toggle the daily route', choice: 'daily' },
      { key: o.touch ? '' : '3', icon: '◈', name: 'WARDROBE', desc: 'Suits, trails and powers for coins', choice: 'shop' },
      { key: o.touch ? '' : 'H', icon: '?', name: 'HOW TO PLAY', desc: 'Controls', choice: 'howto' },
    ];
    const choices = defs.map((d) => d.choice);
    defs.forEach((d, i) => {
      const el = document.createElement('button');
      el.className = 'card' + (i === 0 ? ' primary' : i === 3 ? ' minor' : '');
      el.innerHTML = `${d.key ? `<span class="key">${d.key}</span>` : ''}<span class="icon">${d.icon}</span><span class="name">${d.name}</span><span class="desc">${d.desc}</span>`;
      el.addEventListener('click', () => this.pick(i));
      el.addEventListener('pointerenter', () => this.setHover(i));
      this.cards.appendChild(el);
    });
    this.setHover(0);
    this.primaryIndex = 0; this.escapeIndex = 3;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => choices[i]);
  }

  /** Wardrobe + powers. Re-renders itself after every action; resolves when the player leaves. */
  shop(ctl: ShopController, touch: boolean): Promise<void> {
    let tab: ItemKind = 'suit';
    let msg = touch ? 'TAP AN ITEM TO BUY OR WEAR IT' : 'CLICK AN ITEM TO BUY OR WEAR IT · ESC TO GO BACK';
    const render = () => {
      this.show('WARDROBE', `◎ ${ctl.coins().toLocaleString()} COINS`, msg, true);
      this.cards.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'shop';
      const tabs = document.createElement('div');
      tabs.className = 'tabs';
      for (const [k, label] of [['suit', 'SUITS'], ['trail', 'TRAILS'], ['power', 'POWERS']] as [ItemKind, string][]) {
        const b = document.createElement('button');
        b.className = 'tab' + (k === tab ? ' on' : '');
        b.textContent = label;
        b.addEventListener('click', () => { tab = k; render(); });
        tabs.appendChild(b);
      }
      wrap.appendChild(tabs);
      const grid = document.createElement('div');
      grid.className = 'shop-grid';
      for (const it of ctl.items.filter((i) => i.kind === tab)) {
        const st = ctl.status(it);
        const el = document.createElement('button');
        el.className = `item ${st}`;
        const sw = it.suit
          ? `<span class="swatch" style="background: linear-gradient(135deg, ${css(it.suit.suit)} 0 55%, ${css(it.suit.accent)} 55% 100%)"></span>`
          : it.kind === 'trail'
            ? `<span class="swatch trail" style="background: ${it.trail ? css(it.trail) : 'linear-gradient(135deg, #5ad1ff, #ff7a3c, #c05aff)'}"></span>`
            : `<span class="icon">${it.icon ?? '✦'}</span>`;
        const tag = st === 'equipped' ? 'WEARING' : st === 'owned' ? (it.kind === 'power' ? 'ACTIVE' : 'OWNED · WEAR') : `◎ ${it.price.toLocaleString()}`;
        el.innerHTML = `${sw}<span class="name">${it.name}</span><span class="desc">${it.desc}</span><span class="price">${tag}</span>`;
        el.addEventListener('click', () => { msg = ctl.act(it); render(); });
        grid.appendChild(el);
      }
      wrap.appendChild(grid);
      this.cards.appendChild(wrap);
      const back = document.createElement('button');
      back.className = 'card single minor';
      back.innerHTML = `<span class="icon">←</span><span class="name">BACK</span>`;
      back.addEventListener('click', () => this.pick(this.cards.children.length - 1));
      this.cards.appendChild(back);
      this.primaryIndex = null; this.escapeIndex = this.cards.children.length - 1;
    };
    render();
    return new Promise<number>((res) => { this.resolver = res; }).then(() => undefined);
  }

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
    this.primaryIndex = null; this.escapeIndex = null;   // Space picks the hovered card (see pickPrimary)
    return new Promise((res) => { this.resolver = res; });
  }

  /** Controls card. Resolves on any pick (Space / click / tap). */
  howToPlay(touch: boolean): Promise<number> {
    this.show('RIFTFALL', 'HOW TO PLAY', touch ? 'TAP TO START' : 'PRESS SPACE TO START · H ANYTIME FOR THIS CARD');
    this.cards.innerHTML = '';
    const rows: [string, string, string][] = touch
      ? [['◉', 'MOVE', 'Left stick. Drag right side to look.'], ['JUMP', 'JUMP ×2', 'Hold for a full jump. Tap again in the air for a second jump.'],
         ['LEDGE', 'GRAB', 'Land short? You grab the ledge and pull up. Glowing islands give way — keep moving.'],
         ['DASH', 'AIR DASH', 'Tap mid-jump to cross big gaps.'], ['GRAPPLE', 'GRAPPLE', 'When a ring glows gold, tap to swing. Tap again to let go.'],
         ['WALL', 'WALL-RUN', 'Jump towards a wall while moving. Jump again to leap off.'], ['SLIDE', 'SLIDE', 'Slide while sprinting for a burst of speed.'],
         ['▲', 'THE RIFT', 'It chases you. Keep moving forward. Reach the portal.']]
      : [['WASD', 'MOVE', 'Mouse to look (click once to capture).'], ['SPACE', 'JUMP ×2', 'Hold for a full jump. Press again in the air for a second jump.'],
         ['LEDGE', 'GRAB', 'Land short? You grab the ledge and pull up. Glowing islands give way — keep moving.'],
         ['SHIFT', 'AIR DASH', 'Press mid-jump to cross big gaps.'], ['E', 'GRAPPLE', 'When a ring glows gold, press E to swing. E again to let go.'],
         ['SPACE', 'WALL-RUN', 'Jump towards a wall while moving. Space again to leap off.'], ['C', 'SLIDE', 'Slide while sprinting for a burst of speed.'],
         ['▲', 'THE RIFT', 'It chases you. Keep moving forward. Reach the portal.'], ['M', 'SOUND', 'Toggle music and effects. R restarts the run.']];
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
    this.primaryIndex = 1; this.escapeIndex = 1;
    return new Promise((res) => { this.resolver = res; });
  }

  /** Run summary. Resolves 0 = run again, 1 = back to the title screen. */
  runOver(reason: string, energy: number, bestFlow: number, distance: number, stage: number, bestLine: string, record: string): Promise<number> {
    this.show(record || 'THE RIFT TOOK YOU', reason, bestLine);
    this.cards.innerHTML = '';
    const stats = document.createElement('div');
    stats.className = 'runstats';
    stats.innerHTML = [[`${Math.round(distance)} m`, 'DISTANCE'], [`${stage + 1}`, 'STAGE'], [`+${energy}`, 'COINS'], [`x${bestFlow}`, 'BEST FLOW']]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    this.cards.appendChild(stats);
    const again = document.createElement('button');
    again.className = 'card single primary';
    again.innerHTML = `<span class="icon">↻</span><span class="name">RUN AGAIN</span><span class="desc">SPACE / TAP</span>`;
    again.addEventListener('click', () => this.pick(1));
    this.cards.appendChild(again);
    const menu = document.createElement('button');
    menu.className = 'card single minor';
    menu.innerHTML = `<span class="icon">⌂</span><span class="name">TITLE</span><span class="desc">Wardrobe · Daily</span>`;
    menu.addEventListener('click', () => this.pick(2));
    this.cards.appendChild(menu);
    this.primaryIndex = 1; this.escapeIndex = 2;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => (i === 2 ? 1 : 0));
  }

  pick(i: number): void {
    const r = this.resolver;
    if (!r) return;
    if (i >= this.cards.children.length) return;
    this.resolver = null;
    this.hide();
    r(i);
  }

  /** Space / Enter: the screen's primary action, else the hovered card. */
  pickPrimary(): void { this.pick(this.primaryIndex ?? this.hovered); }
  /** Esc / H: back out of the screen if it has a back action. */
  pickEscape(): boolean { if (this.escapeIndex === null) return false; this.pick(this.escapeIndex); return true; }

  setHover(i: number): void {
    this.hovered = i;
    Array.from(this.cards.children).forEach((c, k) => c.classList.toggle('hover', k === i));
  }
  get hover(): number { return this.hovered; }

  private show(title: string, sub: string, foot: string, light = false): void {
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.foot.textContent = foot;
    this.root.classList.toggle('light', light);
    this.root.hidden = false;
  }
}

function css(c: { r: number; g: number; b: number }): string {
  const u = (v: number) => Math.round(Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2) * 255);   // linear -> sRGB-ish for the swatch
  return `rgb(${u(c.r)}, ${u(c.g)}, ${u(c.b)})`;
}
