import { useEffect, useState } from 'react';
import {
  BOARD_THEMES,
  PIECE_SETS,
  pieceUrl,
  useSettings,
  type BoardTheme,
  type PieceSet,
} from '../lib/settings';
import { Button } from '../ui/Button';
import { IconClose, IconSettings } from '../ui/icons';

/**
 * Panneau des réglages : thème du plateau, jeu de pièces, sons, retournement automatique en
 * hot-seat, coups possibles (classique), garde-fou d'entraînement, coups anticipés, notation
 * française. Échap ou la croix le referment.
 */
export function SettingsPanel(props: { onClose: () => void }) {
  const settings = useSettings();
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="settings-menu" data-testid="settings-menu" role="dialog" aria-label="Réglages">
      <div className="settings-head">
        <strong>Plateau</strong>
        <button
          type="button"
          className="settings-close"
          aria-label="Fermer les réglages"
          data-testid="settings-close"
          onClick={props.onClose}
        >
          <IconClose size={18} />
        </button>
      </div>
      <div className="row">
        {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((key) => (
          <button
            key={key}
            title={BOARD_THEMES[key].label}
            aria-label={`Plateau ${BOARD_THEMES[key].label}`}
            className={`swatch${settings.board === key ? ' selected' : ''}`}
            style={{
              ['--l' as string]: BOARD_THEMES[key].light,
              ['--d' as string]: BOARD_THEMES[key].dark,
            }}
            onClick={() => settings.update({ board: key })}
          />
        ))}
      </div>
      <strong>Pièces</strong>
      <div className="row">
        {(Object.keys(PIECE_SETS) as PieceSet[]).map((key) => (
          <button
            key={key}
            title={PIECE_SETS[key]}
            aria-label={`Pièces ${PIECE_SETS[key]}`}
            className={`piece-choice${settings.pieces === key ? ' selected' : ''}`}
            onClick={() => settings.update({ pieces: key })}
          >
            <img src={pieceUrl(key, 'w', 'n')} alt="" />
          </button>
        ))}
      </div>
      <label>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(e) => settings.update({ sound: e.target.checked })}
        />{' '}
        Sons
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.autoFlip}
          onChange={(e) => settings.update({ autoFlip: e.target.checked })}
        />{' '}
        À deux : tourner le plateau vers le camp au trait
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="setting-legal-moves"
          checked={settings.showLegalMoves}
          onChange={(e) => settings.update({ showLegalMoves: e.target.checked })}
        />{' '}
        Classique : afficher les coups possibles
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="setting-guard"
          checked={settings.trainingGuard}
          onChange={(e) => settings.update({ trainingGuard: e.target.checked })}
        />{' '}
        Entraînement : demander confirmation avant une gaffe
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="setting-premoves"
          checked={settings.premoves}
          onChange={(e) => settings.update({ premoves: e.target.checked })}
        />{' '}
        Coups anticipés (premove)
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="setting-french"
          checked={settings.frenchNotation}
          onChange={(e) => settings.update({ frenchNotation: e.target.checked })}
        />{' '}
        Notation française (C, F, T, D, R)
      </label>
    </div>
  );
}

/** Bouton « Réglages » et son panneau (visiteur non connecté ; sinon : menu du compte). */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="s"
        title="Réglages"
        aria-expanded={open}
        data-testid="settings"
        onClick={() => setOpen(!open)}
      >
        <IconSettings size={18} />
        Réglages
      </Button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}
