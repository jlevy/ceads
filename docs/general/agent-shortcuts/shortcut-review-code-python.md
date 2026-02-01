---
title: Review Code (Python)
description: Perform a code review for Python code following best practices
---
Shortcut: Review Code (Python)

Instructions:

1. Review the Python code for:
   - Type hints and annotations
   - Proper error handling
   - Code organization and modularity
   - Following project conventions (PEP 8)

2. Run `tbd guidelines python-rules` for detailed Python coding guidelines.

3. Check for common issues:
   - Proper use of type hints
   - Avoid mutable default arguments
   - Ensure proper exception handling
   - Check for proper resource management (context managers)

4. Run linting and type checking (if configured):
   ```bash
   ruff check .
   mypy .
   ```

5. Report findings and suggest improvements.
