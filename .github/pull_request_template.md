# Pull request

## Summary

<!-- What changes, and why. One or two sentences. -->

## Scope

- [ ] Portfolio site
- [ ] ShopSure QA
- [ ] PeopleCore QA
- [ ] TaskFlow QA
- [ ] CI / workflows / docs

## Evidence that it works

<!-- Commands you actually ran and their observed result. For example:
     `npm run test:all` → 202 passed / 0 failed
     `npm run verify:site` → 24/24 checks passed
     If something was not executed, say so explicitly — do not imply a green run. -->

## Checklist

- [ ] The change keeps the project's honesty rules: no estimated test results, no invented metrics,
      seeded defects labelled `SEEDED`, unexecuted cases marked `Not Executed`.
- [ ] `npm run lint` passes for the touched package.
- [ ] Relevant suites were executed and their real counts recorded in the PR description.
- [ ] No secrets, `.env` files, database files or generated artefacts are included.
- [ ] Documentation updated when behaviour or scope changed (README, test-documentation, docs/).
