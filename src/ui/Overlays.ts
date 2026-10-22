import type { Upgrade } from '../progression/Upgrade';
import { maxLevel, nextPrice, type MarketItem, type ItemKind } from '../progression/Market';
import type { SaveData } from '../progression/Save';
import type { MissionView } from '../progression/Missions';
import { fmtTime } from './Hud';

export type StartChoice = 'play' | 'daily' | 'shop' | 'stats' | 'howto';
export type PauseChoice = 'resume' | 'howto' | 'quit';
export type VictoryChoice = 'again' | 'endless' | 'title';

/** What the stage-clear screen reports before the upgrade pick. */
export interface StageClearInfo {
  stage: number;          // 0-based stage just cleared
  total: number;          // campaign length
  endless: boolean;
  time: number;
  coins: number;
  rec: { bestTime: boolean; bestCoins: boolean; first: boolean } | null;
  prevBestTime: number;   // 0 = none
  prevBestCoins: number;
  next: string;           // next biome name
  wallet: number;
}

export interface RunSummary {
  title: string;
  reason: string;
  distance: number;
  stages: number;
  total: number;
  coins: number;
  time: number;
  bestFlow: number;
  bestLine: string;
  record: string;
}

/** What the market UI needs from the game to render and act. */
export interface ShopController {
  items: MarketItem[];
  coins(): number;
  /** powers: current level (0 = not owned) */
  level(item: MarketItem): number;
  status(item: MarketItem): 'buy' | 'owned' | 'equipped' | 'max';
  /** buy or equip; returns a short message for the footer */
  act(item: MarketItem): string;
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
  startScreen(o: { coins: number; best: string; daily: boolean; touch: boolean; total: number; missions: MissionView[] }): Promise<StartChoice> {
    this.show('RIFTFALL', 'SKYBREAK', `◎ ${o.coins.toLocaleString()} COINS · ${o.best}`, true);
    this.cards.innerHTML = '';
    const defs: { key: string; icon: string; name: string; desc: string; choice: StartChoice; cls: string }[] = [
      { key: o.touch ? '' : 'SPACE', icon: '▶', name: 'RUN', desc: o.daily ? 'Daily route — same for everyone today' : `Escape the Rift — ${o.total} stages`, choice: 'play', cls: ' primary' },
      { key: o.touch ? '' : '2', icon: '☀', name: o.daily ? 'DAILY: ON' : 'DAILY: OFF', desc: 'Toggle the daily route', choice: 'daily', cls: '' },
      { key: o.touch ? '' : '3', icon: '◈', name: 'MARKET', desc: 'Suits, hair, gear, trails, powers', choice: 'shop', cls: '' },
      { key: o.touch ? '' : '4', icon: '≡', name: 'STATS', desc: 'Records and totals', choice: 'stats', cls: ' minor' },
      { key: o.touch ? '' : 'H', icon: '?', name: 'HOW TO PLAY', desc: 'Controls', choice: 'howto', cls: ' minor' },
    ];
    const choices = defs.map((d) => d.choice);
    defs.forEach((d, i) => {
      const el = document.createElement('button');
      el.className = 'card' + d.cls;
      el.innerHTML = `${d.key ? `<span class="key">${d.key}</span>` : ''}<span class="icon">${d.icon}</span><span class="name">${d.name}</span><span class="desc">${d.desc}</span>`;
      el.addEventListener('click', () => this.pick(i));
      el.addEventListener('pointerenter', () => this.setHover(i));
      this.cards.appendChild(el);
    });
    if (o.missions.length) this.cards.appendChild(missionPanel(o.missions));
    this.setHover(0);
    this.primaryIndex = 0; this.escapeIndex = null;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => choices[i]);
  }

  /** In-run pause. Esc / RESUME continues; QUIT keeps the coins earned so far. */
  pauseMenu(o: { stage: number; total: number; endless: boolean; coins: number; touch: boolean }): Promise<PauseChoice> {
    const where = o.endless ? `ENDLESS · STAGE ${o.stage + 1}` : `STAGE ${o.stage + 1} / ${o.total}`;
    this.show('PAUSED', where, `◎ ${o.coins.toLocaleString()} COINS THIS RUN — BANKED IF YOU QUIT`, true);
    this.cards.innerHTML = '';
    const defs: [string, string, string, PauseChoice, string][] = [
      [o.touch ? '' : 'SPACE', '▶', 'RESUME', 'resume', ' primary'],
      [o.touch ? '' : 'H', '?', 'HOW TO PLAY', 'howto', ' minor'],
      [o.touch ? '' : '3', '⌂', 'QUIT TO TITLE', 'quit', ' minor'],
    ];
    defs.forEach(([key, icon, name, , cls], i) => {
      const el = document.createElement('button');
      el.className = 'card single' + cls;
      el.innerHTML = `${key ? `<span class="key">${key}</span>` : ''}<span class="icon">${icon}</span><span class="name">${name}</span>`;
      el.addEventListener('click', () => this.pick(i));
      this.cards.appendChild(el);
    });
    this.primaryIndex = 0; this.escapeIndex = 0;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => defs[i][3]);
  }

  /** Lifetime records, the per-stage table and the mission board. */
  stats(d: SaveData, total: number, stageName: (i: number) => string, missions: MissionView[], missionsDone: number): Promise<void> {
    this.show('STATS', `${d.runs} RUN${d.runs === 1 ? '' : 'S'} · ${d.wins} ESCAPE${d.wins === 1 ? '' : 'S'} · ${missionsDone} MISSIONS DONE`, 'RECORDS ARE KEPT PER STAGE, PER RUN AND FOR LIFE', true);
    this.cards.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'stats-grid';
    const stars = Object.values(d.stages).filter((s) => s.star).length;
    const cells: [string, string][] = [
      [`◎ ${d.coins.toLocaleString()}`, 'COINS'], [`${d.bestStage} / ${total}`, 'MOST STAGES'], [`★ ${stars} / ${total}`, 'STARS FOUND'],
      [`${d.bestDistance.toLocaleString()} m`, 'BEST DISTANCE'], [`◎ ${d.bestEnergy.toLocaleString()}`, 'BEST RUN COINS'], [d.bestRunTime ? fmtTime(d.bestRunTime) : '—', 'FASTEST ESCAPE'],
      [fmtLong(d.totalTime), 'TIME PLAYED'], [`${d.totalDistance.toLocaleString()} m`, 'TOTAL DISTANCE'], [`◎ ${d.totalCoins.toLocaleString()}`, 'COINS EARNED'],
      [d.dailyBest ? `${d.dailyBest.stages} / ${total}` : '—', `DAILY BEST${d.dailyBest ? ' · ' + d.dailyBest.date.slice(5) : ''}`],
    ];
    grid.innerHTML = cells.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    this.cards.appendChild(grid);
    const table = document.createElement('table');
    table.className = 'stage-table';
    let rows = '<tr><th>#</th><th>STAGE</th><th>BEST TIME</th><th>MOST COINS</th><th>CLEARS</th><th>★</th></tr>';
    for (let i = 0; i < total; i++) {
      const r = d.stages[String(i)];
      const locked = i > d.bestStage;
      const cleared = !!r && r.clears > 0;
      rows += `<tr class="${cleared ? 'done' : locked ? 'locked' : ''}"><td>${cleared ? '✓' : i + 1}</td><td>${stageName(i)}${i === 3 ? ' · TITAN' : ''}</td><td>${cleared ? fmtTime(r.bestTime) : '—'}</td><td>${cleared ? '◎ ' + r.bestCoins.toLocaleString() : '—'}</td><td>${cleared ? r.clears : locked ? 'LOCKED' : '—'}</td><td>${r?.star ? '★' : '·'}</td></tr>`;
    }
    table.innerHTML = rows;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    this.cards.appendChild(wrap);
    if (missions.length) this.cards.appendChild(missionPanel(missions));
    const back = document.createElement('button');
    back.className = 'card single minor';
    back.innerHTML = `<span class="icon">←</span><span class="name">BACK</span>`;
    back.addEventListener('click', () => this.pick(this.cards.children.length - 1));
    this.cards.appendChild(back);
    this.primaryIndex = this.cards.children.length - 1; this.escapeIndex = this.primaryIndex;
    return new Promise<number>((res) => { this.resolver = res; }).then(() => undefined);
  }

  /** The Market. Re-renders itself after every action; resolves when the player leaves. */
  shop(ctl: ShopController, touch: boolean): Promise<void> {
    let tab: ItemKind = 'suit';
    let msg = touch ? 'TAP AN ITEM TO BUY OR WEAR IT' : 'CLICK AN ITEM TO BUY OR WEAR IT · ESC TO GO BACK';
    const render = () => {
      this.show('MARKET', `◎ ${ctl.coins().toLocaleString()} COINS`, msg, true);
      this.cards.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'shop';
      const tabs = document.createElement('div');
      tabs.className = 'tabs';
      for (const [k, label] of [['suit', 'SUITS'], ['hair', 'HAIR'], ['gear', 'GEAR'], ['trail', 'TRAILS'], ['power', 'POWERS']] as [ItemKind, string][]) {
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
        let sw: string;
        if (it.suit) {
          const s = it.suit;
          sw = `<span class="swatch suit"><i style="background:${css(s.torso)}"></i><i style="background:${css(s.sleeves)}"></i><i style="background:${css(s.gloves)}"></i><i style="background:${css(s.pants)}"></i><i style="background:${css(s.boots)}"></i></span>`;
        } else if (it.kind === 'trail') {
          const bg = it.trail === 'rainbow' ? 'linear-gradient(90deg, #ff5a5a, #ffd05a, #5aff8a, #5ad1ff, #c05aff)' : it.trail ? css(it.trail) : 'linear-gradient(135deg, #5ad1ff, #ff7a3c, #c05aff)';
          sw = `<span class="swatch trail" style="background: ${bg}"></span>`;
        } else if (it.kind === 'gear' && it.gear && it.gear.style !== 'none') {
          sw = `<span class="swatch" style="background:${css(it.gear.color)}"></span>`;
        } else if (it.kind === 'hair') {
          sw = `<span class="icon">${it.hair ? '❧' : '○'}</span>`;
        } else sw = `<span class="icon">${it.icon ?? '✦'}</span>`;
        let tag: string;
        if (it.kind === 'power') {
          const lv = ctl.level(it), mx = maxLevel(it), price = nextPrice(it, lv);
          const dots = Array.from({ length: mx }, (_, i) => (i < lv ? '●' : '○')).join(' ');
          tag = `<span class="lv">${dots}</span>${price === null ? 'MAX' : `◎ ${price.toLocaleString()}${lv ? ' · UPGRADE' : ''}`}`;
        } else tag = st === 'equipped' ? 'WEARING' : st === 'owned' ? 'OWNED · WEAR' : it.price === 0 ? 'FREE' : `◎ ${it.price.toLocaleString()}`;
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

  /** Stage cleared: time / coins vs. your records, then pick one upgrade (1/2/3, click, or Space on the hovered card). */
  stageClear(info: StageClearInfo, options: Upgrade[]): Promise<number> {
    const head = info.endless ? `ENDLESS · STAGE ${info.stage + 1} CLEARED` : `STAGE ${info.stage + 1} / ${info.total} CLEARED`;
    const next = info.endless ? `NEXT: ${info.next}` : `NEXT: ${info.next} · STAGE ${info.stage + 2} / ${info.total}`;
    this.show(head, next, `◎ ${info.wallet.toLocaleString()} COINS BANKED · PICK ONE UPGRADE · 1 / 2 / 3 OR CLICK`);
    this.cards.innerHTML = '';
    const stats = document.createElement('div');
    stats.className = 'clear-stats';
    const t = info.rec?.first ? 'FIRST CLEAR' : info.rec?.bestTime ? 'NEW BEST' : info.prevBestTime ? `BEST ${fmtTime(info.prevBestTime)}` : '';
    const c = info.rec?.first ? '' : info.rec?.bestCoins ? 'NEW BEST' : info.prevBestCoins ? `BEST ${info.prevBestCoins.toLocaleString()}` : '';
    stats.innerHTML = `<div><b>${fmtTime(info.time)}</b><span>TIME</span><em>${t}</em></div><div><b>+${info.coins.toLocaleString()}</b><span>COINS</span><em>${c}</em></div>`;
    this.cards.appendChild(stats);
    this.hovered = 0;
    options.forEach((u, i) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.innerHTML = `<span class="key">${i + 1}</span><span class="icon">${u.icon}</span><span class="name">${u.name}</span><span class="desc">${u.desc}</span><span class="why">${u.why}</span>`;
      el.addEventListener('click', () => this.pick(i + 1));
      el.addEventListener('pointerenter', () => this.setHover(i + 1));
      this.cards.appendChild(el);
    });
    this.setHover(1);
    this.primaryIndex = null; this.escapeIndex = null;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => Math.max(0, i - 1));
  }

  /** Campaign complete. */
  victory(o: { time: number; coins: number; bonus: number; distance: number; fastest: boolean; bestLine: string; total: number }): Promise<VictoryChoice> {
    this.show('YOU ESCAPED THE RIFT', o.fastest ? 'FASTEST ESCAPE YET' : `ALL ${o.total} STAGES CLEARED`, o.bestLine);
    this.cards.innerHTML = '';
    const stats = document.createElement('div');
    stats.className = 'runstats';
    stats.innerHTML = [[fmtTime(o.time), 'TIME'], [`+${o.coins.toLocaleString()}`, 'COINS'], [`+${o.bonus}`, 'ESCAPE BONUS'], [`${Math.round(o.distance)} m`, 'DISTANCE']]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    this.cards.appendChild(stats);
    const defs: [string, string, string, VictoryChoice, string][] = [
      ['↻', 'RUN AGAIN', 'SPACE', 'again', ' primary'], ['∞', 'KEEP RUNNING', 'Endless — it only gets harder', 'endless', ''], ['⌂', 'TITLE', 'Wardrobe · Stats', 'title', ' minor'],
    ];
    defs.forEach(([icon, name, desc, , cls], i) => {
      const el = document.createElement('button');
      el.className = 'card single' + cls;
      el.innerHTML = `<span class="icon">${icon}</span><span class="name">${name}</span><span class="desc">${desc}</span>`;
      el.addEventListener('click', () => this.pick(i + 1));
      this.cards.appendChild(el);
    });
    this.primaryIndex = 1; this.escapeIndex = 3;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => defs[Math.max(0, i - 1)][3]);
  }

  /** Controls card. Resolves on any pick (Space / click / tap). */
  howToPlay(touch: boolean, total = 20): Promise<number> {
    this.show('RIFTFALL', 'HOW TO PLAY', touch ? 'TAP TO CONTINUE' : 'SPACE TO CONTINUE · P PAUSES · H SHOWS THIS CARD');
    this.cards.innerHTML = '';
    const rows: [string, string, string][] = touch
      ? [['◉', 'MOVE', 'Thumb anywhere on the lower-left. A short push is a full sprint. Drag right side to look.'], ['JUMP', 'JUMP ×2', 'Hold for a full jump. Tap again in the air for a second jump.'],
         ['LEDGE', 'GRAB', 'Land short? You grab the ledge and pull up. Glowing islands give way — keep moving.'],
         ['DASH', 'AIR DASH', 'Tap mid-jump to cross big gaps.'], ['GRAPPLE', 'GRAPPLE', 'When a ring glows gold, tap to swing. Tap again to let go.'],
         ['WALL', 'WALL-RUN', 'Jump towards a wall while moving. Jump again to leap off.'], ['SLIDE', 'SLIDE', 'Duck under low gates and keep your speed.'],
         ['★', 'STARS', 'One hidden star per stage, off the obvious line.'],
         ['▲', 'THE RIFT', `It chases you. ${total} stages to escape. From stage 5 it outruns a plain sprint — Market powers keep you ahead.`], ['❚❚', 'PAUSE', 'Top-right button: pause, controls, quit to title.']]
      : [['WASD', 'MOVE', 'Mouse to look (click once to capture).'], ['SPACE', 'JUMP ×2', 'Hold for a full jump. Press again in the air for a second jump.'],
         ['LEDGE', 'GRAB', 'Land short? You grab the ledge and pull up. Glowing islands give way — keep moving.'],
         ['SHIFT', 'AIR DASH', 'Press mid-jump to cross big gaps.'], ['E', 'GRAPPLE', 'When a ring glows gold, press E to swing. E again to let go.'],
         ['SPACE', 'WALL-RUN', 'Jump towards a wall while moving. Space again to leap off.'], ['C', 'SLIDE', 'Duck under low gates and keep your speed. Works from a standstill at a gate.'],
         ['★', 'STARS', 'One hidden star per stage, off the obvious line. Missions pay coins for them.'],
         ['▲', 'THE RIFT', `It chases you. ${total} stages to escape. From stage 5 it outruns a plain sprint — Market powers keep you ahead.`], ['P', 'PAUSE', 'P or Esc: pause, controls, quit to title. M sound · R restart.']];
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

  /** Run summary. Resolves 0 = run again, 1 = title, 2 = market. */
  runOver(r: RunSummary): Promise<number> {
    this.show(r.record || r.title, r.reason, r.bestLine);
    this.cards.innerHTML = '';
    const stats = document.createElement('div');
    stats.className = 'runstats';
    stats.innerHTML = [[`${r.stages} / ${r.total}`, 'STAGES'], [`${Math.round(r.distance)} m`, 'DISTANCE'], [`+${r.coins.toLocaleString()}`, 'COINS BANKED'], [fmtTime(r.time), 'TIME'], [`x${r.bestFlow}`, 'BEST FLOW']]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    this.cards.appendChild(stats);
    const again = document.createElement('button');
    again.className = 'card single primary';
    again.innerHTML = `<span class="icon">↻</span><span class="name">RUN AGAIN</span><span class="desc">SPACE / TAP</span>`;
    again.addEventListener('click', () => this.pick(1));
    this.cards.appendChild(again);
    const market = document.createElement('button');
    market.className = 'card single minor';
    market.innerHTML = `<span class="icon">◈</span><span class="name">MARKET</span><span class="desc">Spend what you banked</span>`;
    market.addEventListener('click', () => this.pick(2));
    this.cards.appendChild(market);
    const menu = document.createElement('button');
    menu.className = 'card single minor';
    menu.innerHTML = `<span class="icon">⌂</span><span class="name">TITLE</span><span class="desc">Stats · Daily</span>`;
    menu.addEventListener('click', () => this.pick(3));
    this.cards.appendChild(menu);
    this.primaryIndex = 1; this.escapeIndex = 3;
    return new Promise<number>((res) => { this.resolver = res; }).then((i) => (i === 3 ? 1 : i === 2 ? 2 : 0));
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
    // every card needs the mouse; hand it back if the game had captured it
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

/** 1h 23m / 12m 05s */
function fmtLong(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : `${m}m ${r < 10 ? '0' : ''}${r}s`;
}

/** Three active missions with progress bars and rewards. */
function missionPanel(ms: MissionView[]): HTMLElement {
  const p = document.createElement('div');
  p.className = 'missions';
  p.innerHTML = `<h3>MISSIONS</h3>` + ms.map((v) => {
    const pct = Math.round((v.progress / v.m.target) * 100);
    const prog = v.m.target > 1 ? `${v.progress.toLocaleString()} / ${v.m.target.toLocaleString()}` : v.progress >= 1 ? 'DONE' : '';
    return `<div class="mission"><span class="mtext">${v.m.text}</span><span class="mreward">+◎ ${v.m.reward}</span><span class="mprog">${prog}</span><i style="width:${pct}%"></i></div>`;
  }).join('');
  return p;
}

function css(c: { r: number; g: number; b: number }): string {
  const u = (v: number) => Math.round(Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2) * 255);   // linear -> sRGB-ish for the swatch
  return `rgb(${u(c.r)}, ${u(c.g)}, ${u(c.b)})`;
}
