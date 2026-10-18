import { useState } from 'react';
import { TIME_CONTROLS, TIME_CONTROL_IDS, type TimeControlId } from '@sq/shared';
import { DEFAULT_LAST_PLAY, useSettings } from '../lib/settings';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { FELT_LEVELS } from '../lib/onboarding';

const TC_HINT: Record<TimeControlId, string> = {
  'bullet-1+0': 'Bullet : tout au réflexe',
  'blitz-3+2': 'Blitz avec incrément',
  'blitz-5+0': 'Blitz : le classique',
  'rapid-10+0': 'Rapide : le temps de réfléchir',
  untimed: 'Sans pendule : à ton rythme',
};

const STEP_TITLES = ['Ton niveau', 'Ta cadence préférée', 'Tes parties chess.com'] as const;

/**
 * Premier lancement guidé, en trois étapes : niveau ressenti (présélectionne le niveau du bot),
 * cadence préférée, import chess.com facultatif (pseudo enregistré, lien vers l'Analyse).
 * « Passer » est toujours possible et garde les choix déjà faits.
 */
export function Onboarding(props: { onDone: () => void }) {
  const settings = useSettings();
  const base = settings.lastPlay ?? DEFAULT_LAST_PLAY;
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<number | null>(null);
  const [tc, setTc] = useState<TimeControlId | null>(null);
  const [username, setUsername] = useState(settings.chessComUsername);

  const finish = (withUsername: boolean) => {
    const name = username.trim().slice(0, 40);
    settings.update({
      onboarded: true,
      lastPlay: {
        ...base,
        level: level ?? base.level,
        timeControl: tc ?? base.timeControl,
      },
      ...(withUsername && name ? { chessComUsername: name } : {}),
    });
    props.onDone();
  };

  const skip = (
    <Button variant="ghost" data-testid="onboarding-skip" onClick={() => finish(false)}>
      Passer
    </Button>
  );

  return (
    <Dialog
      title={STEP_TITLES[step]}
      onClose={() => finish(false)}
      testId="onboarding"
      className="onboarding"
      header={
        <p className="onboarding-step muted" data-testid="onboarding-step">
          Bienvenue ! Étape {step + 1} sur 3
        </p>
      }
    >
      {step === 0 && (
        <>
          <p className="muted">Comment te situes-tu ? Le bot sera réglé en conséquence.</p>
          <div className="onboarding-choices">
            {FELT_LEVELS.map((l) => (
              <Button
                key={l.level}
                data-testid={`felt-${l.level}`}
                pressed={level === l.level}
                onClick={() => {
                  setLevel(l.level);
                  setStep(1);
                }}
              >
                <strong>{l.title}</strong>
                <span className="muted">{l.text}</span>
              </Button>
            ))}
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <p className="muted">Elle sera proposée par défaut pour tes parties.</p>
          <div className="onboarding-choices">
            {TIME_CONTROL_IDS.map((id) => (
              <Button
                key={id}
                data-testid={`onboarding-tc-${id}`}
                pressed={tc === id}
                onClick={() => {
                  setTc(id);
                  setStep(2);
                }}
              >
                <strong>{TIME_CONTROLS[id].label}</strong>
                <span className="muted">{TC_HINT[id]}</span>
              </Button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <form
          className="onboarding-import"
          onSubmit={(e) => {
            e.preventDefault();
            finish(true);
          }}
        >
          <p className="muted">
            Facultatif : ton pseudo chess.com permet d'importer tes parties pour que le coach les
            analyse.
          </p>
          <label>
            Pseudo chess.com
            <input
              value={username}
              maxLength={40}
              autoComplete="off"
              data-testid="onboarding-username"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <div className="actions onboarding-actions">
            <Button variant="primary" type="submit" data-testid="onboarding-finish">
              Terminer
            </Button>
            {username.trim() && (
              <Button href="#/analyse" data-testid="onboarding-import" onClick={() => finish(true)}>
                Importer mes parties
              </Button>
            )}
          </div>
        </form>
      )}
      <div className="onboarding-footer">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Retour
          </Button>
        ) : (
          <span />
        )}
        {skip}
      </div>
    </Dialog>
  );
}
