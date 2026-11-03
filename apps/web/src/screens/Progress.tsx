import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { Coach } from './Coach';
import { Leaderboard } from './Leaderboard';

/**
 * Progrès : compétences, régularité, courbes, objectifs (contenu du coach) puis classement.
 * Sans compte, seul le classement est consultable.
 */
export function Progress() {
  const user = useSession((s) => s.user);
  if (!user) {
    return (
      <div className="page" data-testid="progress">
        <div className="panel page-panel">
          <h2>Progrès</h2>
          <p className="muted">
            Connecte-toi pour suivre tes compétences, tes courbes et tes objectifs.
          </p>
          <Button variant="primary" href="#/login">
            Se connecter
          </Button>
        </div>
        <Leaderboard embedded />
      </div>
    );
  }
  return <Coach footer={<Leaderboard embedded />} />;
}
