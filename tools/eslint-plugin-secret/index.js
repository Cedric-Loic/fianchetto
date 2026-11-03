/**
 * Plugin ESLint local « secret ».
 *
 * Règle `secret/no-expose` : interdit d'appeler `.expose()` (lecture de la valeur d'un
 * `Secret<T>`). La règle est active partout et désactivée uniquement pour la liste blanche
 * de fichiers déclarée dans eslint.config.js. Toute extension de cette liste est une décision
 * à tracer dans docs/DECISIONS.md.
 */

/** @type {import('eslint').Rule.RuleModule} */
const noExpose = {
  meta: {
    type: 'problem',
    docs: {
      description: "Interdit la lecture d'un Secret<T> hors des fichiers autorisés",
    },
    messages: {
      forbidden:
        "Lecture d'un Secret interdite ici. Seuls les fichiers de la liste blanche (eslint.config.js) peuvent appeler expose().",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        const property = callee.property;
        const isExpose =
          (!callee.computed && property.type === 'Identifier' && property.name === 'expose') ||
          (callee.computed && property.type === 'Literal' && property.value === 'expose');
        if (isExpose) context.report({ node, messageId: 'forbidden' });
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-secret' },
  rules: { 'no-expose': noExpose },
};
