# Documentation

Start with the [project README](../README.md) for development commands and runtime
configuration. This index separates current implementation guides from historical
plans and measurements.

## Current guides

| Topic | Guide |
| --- | --- |
| Firebase configuration, account approval, synchronization and sharing | [Firebase setup](migration/FIREBASE_SETUP.md) |
| GitHub Pages preparation and deployment | [Deployment](migration/GITHUB_PAGES_DEPLOYMENT.md) |
| Editor components and form ownership | [Editor structure](../src/app/editor/README.md) |
| Creator data flow and rules | [Creator code guide](migration/CREATOR_CODE_GUIDE.md) |
| Content schema generation and validation | [Schema adapter](migration/SCHEMA_ADAPTER_OVERHAUL.md) |
| Supported schema fields and coverage | [Schema coverage](migration/SCHEMA_CONTENT_COVERAGE.md) |
| Feature-use tracker contract | [Feature uses](feature-uses.md) |
| Lazy loading and retained release assets | [Loading and bundles](loading-and-bundles.md) |
| Test audit, fast checks and affected-file selection | [Testing](testing.md) |
| Repository cleanup decisions and remaining structural concerns | [Maintenance review](maintenance-review.md) |

## Historical plans and evidence

The [migration plan](migration/IMPLEMENTATION_PLAN.md) records the original migration
milestones. Other files under `migration/` include implementation decisions, parity
cases and dated acceptance results. Older paths, counts and status statements in
these records describe their original pass; consult the code and current guides
before treating them as current requirements.

The [UI guide](ui-improvement-guide.md), [usability findings](usability-review-findings.md),
[backlog](usability-next-steps.md), [tablet concept](tablet-layout-concept.md), and
[feature audit](feature-audit.md) cover different review passes. Their proposed work
is not a current completion checklist. Keep the original evidence instead of
duplicating it in new setup documentation.

The [feature and data audit from 31 October 2026](feature-audit-2026-10-31.md)
checks the newer implementation against the schemas and repository examples,
distinguishes remaining data opportunities from shipped features, and prioritizes
correctness, small improvements, creator work and larger architectural changes.
