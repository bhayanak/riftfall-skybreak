import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;

Game.create(canvas)
  .then((game) => {
    (window as unknown as { riftfall: Game }).riftfall = game;
  })
  .catch((err) => {
    console.error(err);
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = `FAILED TO START: ${err?.message ?? err}`;
  });
