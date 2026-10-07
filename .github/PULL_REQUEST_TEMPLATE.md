## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation
- [ ] CI / build

## How it was tested

<!-- Unit tests, browser, emulator, real device (model and OS). Add screenshots for UI changes. -->

## Checklist

- [ ] `npm run verify` passes (format, lint, typecheck, tests, build).
- [ ] Business rules have unit tests (`src/app/domain`).
- [ ] The layer dependency rule is respected (no `infrastructure` import outside the composition root).
- [ ] Database changes use a **new** migration; shipped migrations are untouched.
- [ ] No network call and no user data leaving the device.
- [ ] Documentation (`docs/`) and `CHANGELOG.md` are updated.
