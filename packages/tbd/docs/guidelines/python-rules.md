---
title: Python Rules
description: Python coding rules and best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Python Rules

## Type Hints

- **Function signatures**: Always add type hints to function parameters and returns
- **Complex types**: Use `typing` module for generics, unions, optionals
- **Type aliases**: Create aliases for complex types
- **Runtime checking**: Use `isinstance()` for runtime type validation

## Docstrings

- **All public functions**: Document with Google or NumPy style docstrings
- **Include types in docstrings**: When not using type hints
- **Document exceptions**: List exceptions that may be raised
- **Examples**: Include usage examples for complex functions

## Exception Handling

- **Specific exceptions**: Catch specific exceptions, not bare `except:`
- **Context in errors**: Include helpful context in error messages
- **Re-raise properly**: Use `raise ... from e` to preserve stack trace
- **Custom exceptions**: Create domain-specific exception classes

## Resource Management

- **Context managers**: Use `with` statements for files, connections, locks
- **Cleanup**: Ensure resources are released in finally blocks
- **Generator cleanup**: Use try/finally in generators that manage resources

## Functions

- **No mutable defaults**: Never use `[]` or `{}` as default arguments
- **Single responsibility**: Keep functions focused on one task
- **Return early**: Exit early for error cases to reduce nesting
- **Keyword arguments**: Use for functions with many parameters

## Imports

- **Organization**: stdlib, third-party, local (separated by blank lines)
- **Absolute imports**: Prefer absolute over relative imports
- **No star imports**: Never use `from module import *`
- **Import what you use**: Don’t import entire modules if using one function

## Code Style

- **PEP 8**: Follow PEP 8 naming conventions
- **List comprehensions**: Use when clearer than loops
- **F-strings**: Prefer f-strings for string formatting
- **Pathlib**: Use `pathlib.Path` over `os.path`

## Security

- **No eval/exec**: Never use with untrusted input
- **Parameterized queries**: Use placeholders for SQL/commands
- **Input validation**: Validate and sanitize all external input
- **Secrets management**: Use environment variables or secret managers
