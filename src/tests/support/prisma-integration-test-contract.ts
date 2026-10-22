import ts from "typescript";

const TEST_DECLARATION_ALIASES = new Set(["describe", "suite", "it", "test"]);
const DISALLOWED_TEST_MODIFIERS = new Set(["only", "skip", "skipIf", "runIf", "onlyIf", "todo"]);
const DYNAMIC_COMPUTED_MODIFIER = Symbol("dynamic computed modifier");

function getStaticPropertyName(expression: ts.ElementAccessExpression): string | undefined {
  return ts.isStringLiteral(expression.argumentExpression)
    ? expression.argumentExpression.text
    : undefined;
}

function getTestDeclarationModifiers(
  expression: ts.Expression,
): (string | typeof DYNAMIC_COMPUTED_MODIFIER)[] | undefined {
  if (ts.isIdentifier(expression)) {
    return TEST_DECLARATION_ALIASES.has(expression.text) ? [] : undefined;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const modifiers = getTestDeclarationModifiers(expression.expression);

    return modifiers ? [...modifiers, expression.name.text] : undefined;
  }

  if (ts.isElementAccessExpression(expression)) {
    const modifiers = getTestDeclarationModifiers(expression.expression);
    const propertyName = getStaticPropertyName(expression);

    if (!modifiers) {
      return undefined;
    }

    return propertyName
      ? [...modifiers, propertyName]
      : [...modifiers, DYNAMIC_COMPUTED_MODIFIER];
  }

  if (ts.isCallExpression(expression)) {
    return getTestDeclarationModifiers(expression.expression);
  }

  return undefined;
}

function hasDisallowedIntegrationTestModifier(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  return (
    getTestDeclarationModifiers(node.expression)?.some(
      (modifier) =>
        modifier === DYNAMIC_COMPUTED_MODIFIER || DISALLOWED_TEST_MODIFIERS.has(modifier),
    ) ?? false
  );
}

export function assertNoFocusedOrSkippedIntegrationTests(source: string): void {
  const sourceFile = ts.createSourceFile(
    "prisma-integration-suite.ts",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  let disallowedModifierFound = false;

  function visit(node: ts.Node): void {
    if (hasDisallowedIntegrationTestModifier(node)) {
      disallowedModifierFound = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (disallowedModifierFound) {
    throw new Error(
      "Prisma integration tests must not contain .only or .skip; must not contain focused or skipped modifiers.",
    );
  }
}
