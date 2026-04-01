# Contributing to warndog

Thanks for wanting to make warndog better. Here's how.

## Setup

```bash
git clone https://github.com/warndog/warndog.git
cd warndog
npm install
npm test
```

## Writing a rule

Rules live in `src/rules/<category>/`. Each rule exports an object:

```js
module.exports = {
  id:              'my-rule',
  description:     'One-liner.',
  defaultSeverity: 'medium',
  explanation:     'Why it matters…',
  badExample:      '// broken code',
  goodExample:     '// fixed code',

  check({ ast, source, sourceLines, filePath, config }) {
    return [{
      line:       42,
      confidence: 80,
      message:    'human description of the problem',
      suggestion: 'how to fix it',
    }];
  },
};
```

Register it in `src/rules/index.js`, then add a test in `tests/unit/rules/`.

## Submitting a PR

1. Fork → branch `rule/my-rule` → add rule + test → `npm test` → PR

## Code style

- `'use strict'` in every file
- Single quotes, semicolons
- Comments explain *why*, not *what*
