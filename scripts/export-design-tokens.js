const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'design-tokens.tokens.json');

function readSource(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function unwrapExpression(expression) {
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function getExportedConst(sourceFile, exportName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) {
        return unwrapExpression(declaration.initializer);
      }
    }
  }

  throw new Error(`Could not find exported const "${exportName}" in ${sourceFile.fileName}`);
}

function propertyNameToString(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new Error(`Unsupported property name: ${name.getText()}`);
}

function literalToValue(node) {
  const expression = unwrapExpression(node);

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (ts.isPrefixUnaryExpression(expression) && ts.isNumericLiteral(expression.operand)) {
    const value = Number(expression.operand.text);
    return expression.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }

  if (ts.isObjectLiteralExpression(expression)) {
    return objectLiteralToValue(expression);
  }

  throw new Error(`Unsupported token value: ${expression.getText()}`);
}

function objectLiteralToValue(objectLiteral) {
  return Object.fromEntries(
    objectLiteral.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported object property: ${property.getText()}`);
      }

      return [propertyNameToString(property.name), literalToValue(property.initializer)];
    }),
  );
}

function toHexByte(value) {
  return Math.round(value).toString(16).padStart(2, '0').toUpperCase();
}

function toFigmaColor(value) {
  const rgbaMatch = value.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  );

  if (!rgbaMatch) {
    return value;
  }

  const [, red, green, blue, alpha] = rgbaMatch;
  return `#${toHexByte(Number(red))}${toHexByte(Number(green))}${toHexByte(Number(blue))}${toHexByte(
    Number(alpha) * 255,
  )}`;
}

function colorTokens(modeTokens) {
  return Object.fromEntries(
    Object.entries(modeTokens).map(([name, value]) => [
      name,
      {
        $type: 'color',
        $value: toFigmaColor(value),
      },
    ]),
  );
}

function dimensionTokens(values, type) {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      {
        $type: type,
        $value: `${value}px`,
      },
    ]),
  );
}

function typographyTokens(values) {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      {
        $type: 'typography',
        $value: {
          fontSize: `${value.fontSize}px`,
          fontWeight: value.fontWeight,
          lineHeight: `${value.lineHeight}px`,
        },
      },
    ]),
  );
}

const colorSource = readSource('src/design/tokens.ts');
const spacingSource = readSource('src/design/spacing.ts');
const radiusSource = readSource('src/design/radius.ts');
const typographySource = readSource('src/design/typography.ts');

const tokens = {
  color: {
    light: colorTokens(objectLiteralToValue(getExportedConst(colorSource, 'lightTokens'))),
    dark: colorTokens(objectLiteralToValue(getExportedConst(colorSource, 'darkTokens'))),
  },
  spacing: dimensionTokens(objectLiteralToValue(getExportedConst(spacingSource, 'spacing')), 'dimension'),
  radius: dimensionTokens(objectLiteralToValue(getExportedConst(radiusSource, 'radius')), 'borderRadius'),
  typography: typographyTokens(objectLiteralToValue(getExportedConst(typographySource, 'typography'))),
};

fs.writeFileSync(outputPath, `${JSON.stringify(tokens, null, 2)}\n`);
console.log(`Exported design tokens to ${path.relative(rootDir, outputPath)}`);
