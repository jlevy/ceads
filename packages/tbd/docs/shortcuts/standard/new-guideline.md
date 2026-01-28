---
title: New Guideline
description: Create a new coding guideline document for tbd
---
Shortcut: New Guideline

This shortcut helps create new guideline documents that agents can reference via
`tbd guidelines <name>`.

## Guideline Types

There are two types of guidelines:

1. **Official tbd guidelines** (bundled with tbd):
   - Location: `packages/tbd/docs/guidelines/`
   - Available to all tbd users after npm publish
   - Should be general-purpose, not project-specific

2. **Project-level guidelines** (custom):
   - Location: `.tbd/docs/guidelines/`
   - Shadow/override official guidelines with same name
   - Project-specific rules and patterns

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Determine guideline type**: Ask the user if this is:
   - An official tbd guideline (for the tbd package itself)
   - A project-level custom guideline

2. **Choose the location**:
   - Official: `packages/tbd/docs/guidelines/<name>.md`
   - Custom: `.tbd/docs/guidelines/<name>.md`

3. **Name the guideline**:
   - Use kebab-case: `typescript-rules`, `api-design-patterns`
   - Be descriptive but concise
   - For domain-specific: `{domain}-rules` or `{domain}-{subtopic}-rules`

4. **Create the guideline file** with this structure:

   ````markdown
   ---
   title: [Human-readable title]
   description: [One-line description for `tbd guidelines --list`]
   ---
   # [Title]
   
   [Introduction paragraph explaining what this guideline covers and when to use it.]
   
   ## [Section 1]
   
   - **Rule name**: Explanation of the rule.
   
     ```typescript
     // Example code if applicable
   ````

   ## [Section 2]

   …

   ## Related Guidelines

   - For [related topic], see `tbd guidelines [related-guideline]`
   ```
   ```

5. **Required elements**:
   - YAML frontmatter with `title` and `description`
   - Clear introduction explaining scope
   - Actionable rules with examples
   - Cross-references to related guidelines (context injection pattern)

6. **Link hygiene** (for official guidelines):
   - Use full public URLs for external references
   - Example: `https://github.com/jlevy/tbd/blob/main/docs/...`
   - Don’t use relative paths that break when doc is installed elsewhere

7. **Test the guideline**:
   ```bash
   tbd guidelines <name>  # Verify it loads correctly
   tbd guidelines --list  # Verify it appears in the list
   ```

8. **For official guidelines**, also:
   - Rebuild tbd: `pnpm build` (in packages/tbd/)
   - Verify bundled: check `packages/tbd/dist/docs/guidelines/<name>.md`

## Guideline Quality Checklist

- [ ] Frontmatter has title and description
- [ ] Introduction explains when to use the guideline
- [ ] Rules are actionable (not vague principles)
- [ ] Code examples where applicable
- [ ] Cross-references to related guidelines
- [ ] No relative links (use full URLs for external refs)
- [ ] Tested with `tbd guidelines <name>`

## Example Frontmatter

```yaml
---
title: TypeScript API Design Rules
description: Best practices for designing TypeScript APIs including naming, types, and error handling
---
```

## Naming Conventions

| Pattern | Example | Use For |
| --- | --- | --- |
| `{lang}-rules` | `typescript-rules` | General language rules |
| `{lang}-{topic}-rules` | `typescript-cli-tool-rules` | Specialized patterns |
| `{domain}-rules` | `convex-rules` | Framework/platform rules |
| `general-{topic}-rules` | `general-testing-rules` | Language-agnostic rules |
