# Testing and release verification

The release checklist is documented in `SUBMISSION-CHECKLIST.md`. Before shipping, run `npm install`, `npm run db:check` after the first application start, `npm run audit:all`, `npm run audit:source`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.

A static schema check can be performed without application dependencies by extracting the schema SQL from `lib/database/db.ts` and running it against SQLite. This check confirms that the DDL parses, but it does not replace installing dependencies, typechecking the application, exercising routes, or running the production build.

The current source archive has been inspected and the SQLite schema has been executed independently. Full Next.js build and test results must be recorded from the target Windows environment after dependencies are installed; do not label them as passed unless the commands complete successfully.
