---
title: Review Code (TypeScript)
description: Perform a code review for TypeScript code following best practices
---
Shortcut: Review Code (TypeScript)

Instructions:

1. Review the TypeScript code for:
   - Type safety and proper type annotations
   - Proper error handling
   - Code organization and modularity
   - Following project conventions

2. Run `tbd guidelines typescript-rules` for detailed TypeScript coding guidelines.

3. Check for common issues:
   - Avoid `any` types unless absolutely necessary
   - Use proper exhaustiveness checks in switch statements
   - Ensure functions have appropriate return types
   - Validate proper use of async/await

4. Run linting and type checking:
   ```bash
   pnpm lint
   pnpm typecheck
   ```

5. Report findings and suggest improvements.
