// Lanceur du worker du bot : active le chargeur TypeScript (tsx) puis charge worker.ts.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
