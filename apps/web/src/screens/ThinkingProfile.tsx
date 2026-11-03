import {
  THINKING_FLAWS,
  THINKING_FLAW_ADVICE,
  THINKING_FLAW_LABELS,
  type ThinkingProfile,
} from '@sq/shared';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

/** Progrès : défauts de réflexion les plus fréquents (revues réflexives) et conseil du principal. */
export function ThinkingProfileCard({ profile }: { profile: ThinkingProfile | null }) {
  const rows = THINKING_FLAWS.map((flaw) => ({ flaw, count: profile?.counts[flaw] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="panel page-panel" data-testid="thinking-profile">
      <h2>Profil de pensée</h2>
      {!profile || profile.reviews === 0 || rows.length === 0 ? (
        <EmptyState
          icon="♞"
          title="Pas encore de revue réflexive"
          action={<Button href="#/analyse">Mes parties</Button>}
        >
          Dans la revue d’une de tes parties, signale d’abord les moments où tu as hésité : ton
          profil de pensée se construit à partir de là.
        </EmptyState>
      ) : (
        <>
          <p className="muted">
            Sur {profile.reviews} revue{profile.reviews > 1 ? 's' : ''} réflexive
            {profile.reviews > 1 ? 's' : ''}.
          </p>
          {rows.map((r) => (
            <div key={r.flaw} className="hbar" data-testid={`thinking-${r.flaw}`}>
              <span>{THINKING_FLAW_LABELS[r.flaw]}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <strong>{r.count}</strong>
            </div>
          ))}
          {profile.top && (
            <p className="move-card" data-testid="thinking-advice">
              <strong>À travailler :</strong> {THINKING_FLAW_ADVICE[profile.top]}
            </p>
          )}
        </>
      )}
    </div>
  );
}
