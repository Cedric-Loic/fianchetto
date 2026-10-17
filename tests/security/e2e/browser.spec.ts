import { expect, test, type Page } from '@playwright/test';
import type { ServerMessage } from '@sq/shared';

/*
 * Attaque côté navigateur, partie réelle contre le bot : tout ce que le navigateur reçoit ou
 * stocke est collecté, y compris après un rafraîchissement en pleine partie. Une fois la partie
 * finie, la révélation dit où était la dame du bot : on vérifie alors que rien, avant la fin,
 * ne l'avait trahie.
 */

async function clickSquare(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const size = box.width / 8;
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

test('frames WebSocket, stockage navigateur et rafraîchissement : aucune fuite', async ({
  page,
}) => {
  const frames: string[] = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(String(f.payload))));

  await page.goto('/#/login');
  await page.getByRole('button', { name: 'Pas de compte ? Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(`sec${Date.now() % 1_000_000_000}`);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await page.getByTestId('variant-secret-queen').click();
  const bot = page.locator('.home-panel', { hasText: 'Contre le bot' });
  await bot.getByTestId('level-1').click();
  await bot.getByRole('button', { name: 'Blancs' }).click();
  await bot.getByRole('button', { name: 'Sans pendule' }).click();
  await bot.getByRole('button', { name: 'Jouer contre le bot' }).click();
  await clickSquare(page, 'h2');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByTestId('move-list')).toBeVisible();

  const moves = page.getByTestId('move-list').locator('button.move');
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(moves).toHaveCount(2, { timeout: 20_000 });

  // Rafraîchissement en pleine partie : la partie reprend, toujours sans fuite.
  await page.reload();
  await expect(moves).toHaveCount(2);
  await clickSquare(page, 'd2');
  await clickSquare(page, 'd4');
  await expect(moves).toHaveCount(4, { timeout: 20_000 });

  // Stockage navigateur pendant la partie : uniquement les préférences d'affichage.
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    idb: (await indexedDB.databases()).map((d) => d.name),
    cookies: document.cookie,
  }));
  expect(storage.local.every((k) => k === 'sq-settings')).toBe(true);
  expect(storage.session).toEqual([]);
  expect(storage.idb).toEqual([]);
  expect(storage.cookies).toBe(''); // cookie de session httpOnly : illisible en JS

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '⚑ Abandonner' }).click();
  await expect(page.getByTestId('end-modal')).toBeVisible();

  const messages = frames.map((f) => JSON.parse(f) as ServerMessage);
  const end = messages.findIndex((m) => m.type === 'snapshot' && m.state.phase === 'ended');
  const final = messages[end];
  if (final?.type !== 'snapshot' || !final.state.board?.reveal) throw new Error('pas de fin');
  const botQueen = final.state.board.reveal.secrets.b;
  const fens = [
    final.state.board.reveal.realInitialFen,
    ...final.state.board.reveal.plies.map((p) => p.realFenAfter),
  ];

  const before = messages.slice(0, end);
  expect(before.length).toBeGreaterThan(5);
  for (const [i, m] of before.entries()) {
    const text = frames[i] ?? '';
    for (const fen of fens) expect(text).not.toContain(fen);
    if (m.type !== 'snapshot' || !m.state.board) continue;
    expect(m.state.board.reveal).toBeNull();
    // La dame du bot est toujours affichée comme un pion et n'est jamais « mon » secret.
    const piece = m.state.board.pieces.find((p) => p.id === botQueen.pieceId);
    if (piece) expect(piece.type).toBe('p');
    expect(m.state.board.ownSecret?.pieceId).not.toBe(botQueen.pieceId);
  }
});
