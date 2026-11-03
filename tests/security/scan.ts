import { REDACTED } from './canary.js';

/**
 * Analyse récursive d'une valeur observable (projection, coup public, message) à la recherche
 * de clés ou de valeurs interdites avant la fin de partie (`docs/RULES.md` §2).
 */

export interface Finding {
  /** Chemin dans la valeur, ex. `$.moves[3].san`. */
  path: string;
  rule: string;
  detail: string;
}

interface KeyRule {
  rule: string;
  key: RegExp;
}

/**
 * Clés interdites dans tout ce que voit un joueur avant la fin. Un contrat légitime n'en
 * contient aucune : `castle` (PublicMove) et `ownSecret` sont explicitement autorisées plus bas.
 */
export const FORBIDDEN_KEY_RULES: readonly KeyRule[] = [
  { rule: 'fen', key: /fen/i },
  { rule: 'notation-ou-type-reel', key: /^(real|true|actual|hidden)/i },
  { rule: 'prise-en-passant', key: /en_?passant|^ep(_?square)?$|^ep[A-Z]/i },
  { rule: 'compteur-50-coups', key: /half_?move|fifty|^rule_?50$|^hmc$/i },
  { rule: 'droits-de-roque', key: /castling|can_?castle|castle_?rights/i },
  { rule: 'repetition', key: /repetition/i },
  { rule: 'coups-legaux', key: /legal|^dests$/i },
  { rule: 'secret', key: /secret/i },
  { rule: 'motif', key: /^(reason|why|motive|motif|error|message|details?)$/i },
];

/**
 * Clés autorisées seulement si leur valeur est `null`. `legalMoves` (variante classique) est
 * TOUJOURS nulle en Secret Queen : une liste, même vide, reste une fuite détectée.
 */
const NULL_ONLY_KEYS: ReadonlyArray<{ rule: string; path: RegExp }> = [
  { rule: 'coups-legaux', path: /(^|\.)legalMoves$/ },
];

/** Clés autorisées malgré une règle (chemin complet → règle levée). */
const ALLOWED_KEYS: ReadonlyArray<{ rule: string; path: RegExp }> = [
  // Le spectateur voit son propre secret (contenu vérifié ailleurs).
  { rule: 'secret', path: /(^|\.)ownSecret$/ },
  // `result.reason` est une annonce publique de fin.
  { rule: 'motif', path: /(^|\.)result\.reason$/ },
];

/** Partie « placement des pièces » d'une FEN (8 rangées séparées par des « / »). */
export const FEN_PLACEMENT_RE = /(?:[pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}/;

export interface ScanOptions {
  /** Après la fin seulement : le sous-arbre `reveal` est légitime et n'est pas analysé. */
  allowReveal?: boolean;
  /** Chaînes (canaris) à rechercher dans toutes les valeurs textuelles. */
  tokens?: readonly string[];
  /**
   * Le marqueur « [REDACTED] » dans un payload signifie qu'un `Secret` s'y est glissé
   * (mécanisme 3 de `docs/SECURITY.md`). Vrai par défaut.
   */
  forbidRedactedMarker?: boolean;
  /** Chemins supplémentaires autorisés malgré une règle de clé (ex. `/\.history\[\d+\]\.reason$/`). */
  allowPaths?: readonly RegExp[];
}

const keyRuleCache = new Map<string, readonly string[]>();

/** Règles de clé déclenchées par un nom de clé (mis en cache : les clés se répètent). */
function rulesMatchingKey(key: string): readonly string[] {
  let rules = keyRuleCache.get(key);
  if (!rules) {
    rules = FORBIDDEN_KEY_RULES.filter((r) => r.key.test(key)).map((r) => r.rule);
    keyRuleCache.set(key, rules);
  }
  return rules;
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function keyPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

/**
 * Parcourt une valeur de données (objets simples, tableaux, primitives) et renvoie toutes les
 * violations : clé interdite, FEN, canari, marqueur « [REDACTED] », `undefined` (les contrats
 * imposent `null`), fonction, instance de classe (dont `Secret`), Map/Set, symbole.
 */
export function findForbidden(value: unknown, options: ScanOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const tokens = options.tokens ?? [];
  const forbidRedacted = options.forbidRedactedMarker ?? true;
  const seen = new Set<object>();

  const visitString = (text: string, path: string): void => {
    // Une FEN compte au moins 15 caractères (8 rangées et 7 « / »).
    if (text.length >= 15 && FEN_PLACEMENT_RE.test(text)) {
      findings.push({ path, rule: 'fen', detail: `chaîne de type FEN : ${text}` });
    }
    if (forbidRedacted && text.includes(REDACTED)) {
      findings.push({ path, rule: 'secret-masque', detail: 'marqueur [REDACTED] dans un payload' });
    }
    for (const token of tokens) {
      if (token.length > 0 && text.includes(token)) {
        findings.push({ path, rule: 'canari', detail: `jeton ${token}` });
      }
    }
  };

  const visit = (node: unknown, path: string): void => {
    if (node === null || typeof node === 'boolean' || typeof node === 'number') return;
    if (node === undefined) {
      findings.push({ path, rule: 'undefined', detail: 'valeur undefined (null attendu)' });
      return;
    }
    if (typeof node === 'string') {
      visitString(node, path);
      return;
    }
    if (typeof node === 'function' || typeof node === 'symbol' || typeof node === 'bigint') {
      findings.push({ path, rule: 'non-donnee', detail: `valeur de type ${typeof node}` });
      return;
    }
    if (seen.has(node)) {
      findings.push({ path, rule: 'cycle', detail: 'référence circulaire' });
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(node)) {
      const tag = Object.prototype.toString.call(node);
      findings.push({ path, rule: 'non-donnee', detail: `objet non simple ${tag}` });
    }
    for (const symbol of Object.getOwnPropertySymbols(node)) {
      findings.push({ path, rule: 'non-donnee', detail: `clé symbole ${String(symbol)}` });
    }
    for (const key of Object.getOwnPropertyNames(node)) {
      const childPath = keyPath(path, key);
      if (options.allowReveal && key === 'reveal') continue;
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      for (const rule of rulesMatchingKey(key)) {
        if (ALLOWED_KEYS.some((a) => a.rule === rule && a.path.test(childPath))) continue;
        const isNull =
          descriptor !== undefined && 'value' in descriptor && descriptor.value === null;
        if (isNull && NULL_ONLY_KEYS.some((a) => a.rule === rule && a.path.test(childPath))) {
          continue;
        }
        if (options.allowPaths?.some((re) => re.test(childPath))) continue;
        findings.push({ path: childPath, rule, detail: `clé interdite « ${key} »` });
      }
      visitString(key, `${childPath} (clé)`);
      if (descriptor && !('value' in descriptor)) {
        findings.push({ path: childPath, rule: 'non-donnee', detail: 'accesseur (getter)' });
        continue;
      }
      visit(descriptor?.value, childPath);
    }
  };

  visit(value, '$');
  return findings;
}

export interface ReachableValue {
  path: string;
  value: unknown;
}

/**
 * Parcours par RÉFLEXION d'un objet quelconque (instance de classe comprise) : propriétés
 * propres, énumérables ou non, clés symboles, entrées de Map et de Set. Les champs privés `#`
 * et les instances de `Secret` sont opaques par construction et ne sont pas traversés.
 * Les accesseurs ne sont pas appelés.
 */
export function reachableByReflection(root: unknown, maxNodes = 100_000): ReachableValue[] {
  const out: ReachableValue[] = [];
  const seen = new Set<object>();
  const stack: ReachableValue[] = [{ path: '$', value: root }];
  while (stack.length > 0 && out.length < maxNodes) {
    const current = stack.pop();
    if (!current) break;
    out.push(current);
    const { path, value } = current;
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (Object.prototype.toString.call(value) === '[object Secret]') continue;
    if (value instanceof Map) {
      for (const [k, v] of value) {
        stack.push({ path: `${path}<map:${String(k)}>`, value: v });
        stack.push({ path: `${path}<mapkey>`, value: k });
      }
    } else if (value instanceof Set) {
      for (const v of value) stack.push({ path: `${path}<set>`, value: v });
    }
    if (typeof value === 'function') continue;
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) continue;
      stack.push({ path: `${path}.${String(key)}`, value: descriptor.value as unknown });
    }
  }
  return out;
}

/**
 * Indices d'un état réel accessible par réflexion : FEN, jetons canaris, objet ressemblant à
 * un moteur d'échecs (méthodes `fen`, `board`, `moves`…).
 */
export function findRealStateByReflection(root: unknown, tokens: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  for (const { path, value } of reachableByReflection(root)) {
    if (typeof value === 'string') {
      if (FEN_PLACEMENT_RE.test(value)) {
        findings.push({ path, rule: 'fen', detail: value });
      }
      for (const token of tokens) {
        if (value.includes(token)) findings.push({ path, rule: 'canari', detail: token });
      }
    } else if (value !== null && typeof value === 'object') {
      const engineLike = ['fen', 'board', 'ascii'].filter(
        (name) => typeof (value as Record<string, unknown>)[name] === 'function',
      );
      if (engineLike.length >= 2) {
        findings.push({
          path,
          rule: 'moteur-accessible',
          detail: `objet exposant ${engineLike.join(', ')} hors champ privé`,
        });
      }
    }
  }
  return findings;
}

/** Résumé lisible d'une liste de violations (messages d'échec des tests). */
export function formatFindings(findings: readonly Finding[], max = 10): string {
  const lines = findings.slice(0, max).map((f) => `${f.rule} @ ${f.path} : ${f.detail}`);
  if (findings.length > max) lines.push(`… et ${findings.length - max} autres`);
  return lines.join('\n');
}
