import { Game } from './core/Game';

declare const __APP_VERSION__: string;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ver = document.getElementById('version');
if (ver) ver.textContent = `v${__APP_VERSION__}`;

Game.create(canvas)
  .then((game) => {
    (window as unknown as { riftfall: Game }).riftfall = game;
  })
  .catch((err) => {
    console.error(err);
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = `FAILED TO START: ${err?.message ?? err}`;
  });
