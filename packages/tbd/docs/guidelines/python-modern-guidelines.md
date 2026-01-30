---
title: Python Modern Guidelines
description: Guidelines for modern Python projects using uv, with opinionated practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.py, pyproject.toml"
alwaysApply: false
---
# Python Modern Guidelines

These are rules for a modern Python project using uv.

## Python Version

Write for Python 3.11-3.13. Do NOT write code to support earlier versions of Python.
Always use modern Python practices appropriate for Python 3.11-3.13.

Always use full type annotations, generics, and other modern practices.

## Very Strongly Prefer `uv`!

Unless there is a compelling reason for backward compatibility, use uv.
Use `uv` for all Python package management and one-off use cases.
Use `uvx` to run packages that may not be installed.

DO NOT use `pip`, `pipx`, `pyenv`, `twine`, `virtualenv`, or `poetry` or any other older
Python packaging tools unless absolutely necessary.

[Read the uv docs overview here](https://docs.astral.sh/uv/llms.txt) to find the
appropriate docs.

## Project Setup and Developer Workflows

- Important: BE SURE you read and understand the project setup by reading the
  pyproject.toml file and the Makefile.

- ALWAYS use uv for running all code and managing dependencies.
  Never use direct `pip` or `python` commands.

- Use modern uv commands: `uv sync`, `uv run ...`, etc.
  Prefer `uv add` over `uv pip install`.

- You may use the following shortcuts

  ```shell
  
  # Install all dependencies:
  make install
  
  # Run linting (with ruff) and type checking (with basedpyright).
  # Note when you run this, ruff will auto-format and sort imports, resolving any
  # linter warnings about import ordering:
  make lint
  
  # Run tests:
  make test
  
  # Run uv sync, lint, and test in one command:
  make
  ```

- The usual `make test` like standard pytest does not show test output.
  Run individual tests and see output with `uv run pytest -s some/file.py`.

- Always run `make lint` and `make test` to check your code after changes.

- You must verify there are zero linter warnings/errors or test failures before
  considering any task complete.

## General Development Practices

- Be sure to resolve the pyright (basedpyright) linter errors as you develop and make
  changes.

- If type checker errors are hard to resolve, you may add a comment `# pyright: ignore`
  to disable Pyright warnings or errors but ONLY if you know they are not a real problem
  and are difficult to fix.

- In special cases you may consider disabling it globally it in pyproject.toml but YOU
  MUST ASK FOR CONFIRMATION from the user before globally disabling lint or type checker
  rules.

- Never change an existing comment, pydoc, or a log statement, unless it is directly
  fixing the issue you are changing, or the user has asked you to clean up the code.
  Do not drop existing comments when editing code!
  And do not delete or change logging statements.

## Coding Conventions and Imports

- Always use full, absolute imports for paths.
  do NOT use `from .module1.module2 import ...`. Such relative paths make it hard to
  refactor. Use `from toplevel_pkg.module1.modlule2 import ...` instead.

- Be sure to import things like `Callable` and other types from the right modules,
  remembering that many are now in `collections.abc` or `typing_extensions`. For
  example: `from collections.abc import Callable, Coroutine`

- Use `typing_extensions` for things like `@override` (you need to use this, and not
  `typing` since we want to support Python 3.11).

- Add `from __future__ import annotations` on files with types whenever applicable.

- Use pathlib `Path` instead of strings.
  Use `Path(filename).read_text()` instead of two-line `with open(...)` blocks.

- Use strif’s `atomic_output_file` context manager when writing files to ensure output
  files are written atomically.

## Testing

- For longer tests put them in a file like `tests/test_somename.py` in the `tests/`
  directory (or `tests/module_name/test_somename.py` file for a submodule).

- For simple tests, prefer inline functions in the original code file below a `## Tests`
  comment. This keeps the tests easy to maintain and close to the code.
  Inline tests should NOT import pytest or pytest fixtures as we do not want runtime
  dependency on pytest.

- DO NOT write one-off test code in extra files that are throwaway.

- DO NOT put `if __name__ == "__main__":` just for quick testing.
  Instead use the inline function tests and run them with `uv run pytest`.

- You can run such individual tests with `uv run pytest -s src/.../path/to/test`

- Don’t add docs to assertions unless it’s not obvious what they’re checking - the
  assertion appears in the stack trace.
  Do NOT write `assert x == 5, "x should be 5"`. Do NOT write
  `assert x == 5 # Check if x is 5`. That is redundant.
  Just write `assert x == 5`.

- DO NOT write trivial or obvious tests that are evident directly from code, such as
  assertions that confirm the value of a constant setting.

- NEVER write `assert False`. If a test reaches an unexpected branch and must fail
  explicitly, `raise AssertionError("Some explanation")` instead.
  This is best typical best practice in Python since assertions can be removed with
  optimization.

- DO NOT use pytest fixtures like parameterized tests or expected exception decorators
  unless absolutely necessary in more complex tests.
  It is typically simpler to use simple assertions and put the checks inside the test.
  This is also preferable because then simple tests have no explicit pytest dependencies
  and can be placed in code anywhere.

- DO NOT write trivial tests that test something we know already works, like
  instantiating a Pydantic object.

  ```python
  class Link(BaseModel):
    url: str
    title: str = None
  
  # DO NOT write tests like this. They are trivial and only create clutter!
  def test_link_model():
    link = Link(url="https://example.com", title="Example")
    assert link.url == "https://example.com"
    assert link.title == "Example"
  ```

## Types and Type Annotations

- ALWAYS use `@override` decorators to override methods from base classes.
  This is a modern Python practice and helps avoid bugs.

- Use modern union syntax: `str | None` instead of `Optional[str]`, `dict[str]` instead
  of `Dict[str]`, `list[str]` instead of `List[str]`, etc.

- Never use/import `Optional` for new code.

- Use modern enums like `StrEnum` if appropriate.

- One exception to common practice on enums: If an enum has many values that are
  strings, and they have a literal value as a string (like in a JSON protocol), it’s
  fine to use lower_snake_case for enum values to match the actual value.
  This is more readable than LONG_ALL_CAPS_VALUES, and you can simply set the value to
  be the same as the name for each.
  For example:

  ```python
  class MediaType(Enum):
    """
    Media types. For broad categories only, to determine what processing
    is possible.
    """
  
    text = "text"
    image = "image"
    audio = "audio"
    video = "video"
    webpage = "webpage"
    binary = "binary"
  ```

## Guidelines for Literal Strings

- For multi-line strings NEVER put multi-line strings flush against the left margin.
  ALWAYS use a `dedent()` function to make it more readable.
  You may wish to add a `strip()` as well.
  Example:
  ```python
  from textwrap import dedent
  markdown_content = dedent("""
      # Title 1
      Some text.
      ## Subtitle 1.1
      More text.
      """).strip()
  ```

## Guidelines for Comments

- Comments should be EXPLANATORY: Explain *WHY* something is done a certain way and not
  just *what* is done.

- Comments should be CONCISE: Remove all extraneous words.

- DO NOT use comments to state obvious things or repeat what is evident from the code.
  Here is an example of a comment that SHOULD BE REMOVED because it simply repeats the
  code, which is distracting and adds no value:
  ```python
  if self.failed == 0:
      # All successful
      return "All tasks finished successfully"
  ```

## Guidelines for Docstrings

- Here is an example of the correct style for docstrings:

  ```python
  def check_if_url(
      text: UnresolvedLocator, only_schemes: list[str] | None = None
  ) -> ParseResult | None:
      """
      Convenience function to check if a string or Path is a URL and if so return
      the `urlparse.ParseResult`.
  
      Also returns false for Paths, so that it's easy to use local paths and URLs
      (`Locator`s) interchangeably. Can provide `HTTP_ONLY` or `HTTP_OR_FILE` to
      restrict to only certain schemes.
      """
      # Function body
  
  def is_url(text: UnresolvedLocator, only_schemes: list[str] | None = None) -> bool:
      """
      Check if a string is a URL. For convenience, also returns false for
      Paths, so that it's easy to use local paths and URLs interchangeably.
      """
      return check_if_url(text, only_schemes) is not None
  ```

- Use concise pydoc strings with triple quotes on their own lines.

- Use `backticks` around variable names and inline code excerpts.

- Use plain fences (```) around code blocks inside of pydocs.

- For classes with many methods, use a concise docstring on the class that explains all
  the common information, and avoid repeating the same information on every method.

- Docstrings should provide context or as concisely as possible explain “why”, not
  obvious details evident from the class names, function names, parameter names, and
  type annotations.

- Docstrings *should* mention any key rationale or pitfalls when using the class or
  function.

- Avoid obvious or repetitive docstrings.
  Do NOT add pydocs that just repeat in English facts that are obvious from the function
  name, variable name, or types.
  That is silly and obvious and makes the code longer for no reason.

- Do NOT list args and return values if they’re obvious.
  In the above examples, you do not need and `Arguments:` or `Returns:` section, since
  sections as it is obvious from context.
  do list these if there are many arguments and their meaning isn’t clear.
  If it returns a less obvious type like a tuple, do explain in the pydoc.

- Exported/public variables, functions, or methods SHOULD have concise docstrings.
  Internal/local variables, functions, and methods DO NOT need docstrings unless their
  purpose is not obvious.

## General Clean Coding Practices

- Avoid writing trivial wrapper functions.
  For example, when writing a class DO NOT blindly make delegation methods around public
  member variables. DO NOT write methods like this:

  ```python
      def reassemble(self) -> str:
        """Call the original reassemble method."""
        return self.paragraph.reassemble()
  ```

  In general, the user can just call the enclosed objects methods, reducing code bloat.

- If a function does not use a parameter, but it should still be present, you can use
  `# pyright: ignore[reportUnusedParameter]` in a comment to suppress the linter
  warning.

## Guidelines for Backward Compatibility

- When changing code in a library or general function, if a change to an API or library
  will break backward compatibility, MENTION THIS to the user.

- DO NOT implement additional code for backward compatiblity (such as extra methods or
  variable aliases or comments about backward compatibility) UNLESS the user has
  confirmed that it is necessary.

## Atomic Output Files

Always write files using an atomic process so partial files are never created.
The best way to do this is `with_atomic_output_file` from
[strif](https://github.com/jlevy/strif).
Add this as a dependency (it is small).

```python
# It is always a good idea to wrap `open` with `atomic_output_file`:
with atomic_output_file("some-dir/my-final-output.txt") as temp_target:
    with open(temp_target, "w") as f:
        f.write("some contents")

# There are also some handy additional options:
with atomic_output_file("some-dir/my-final-output.txt",
                        make_parents=True, backup_suffix=".old.{timestamp}") as temp_target:
    with open(temp_target, "w") as f:
        f.write("some contents")
```

## String Abbreviations, Plurals, and Date, Time, and Time Delta Formats

Use [prettyfmt](https://github.com/jlevy/prettyfmt) to format human friendly log outputs
of more complex date, time, ages of items, or objects.
It is small, recent, and has fewer dependencies than other libraries.

```python
# Docs from https://github.com/jlevy/prettyfmt:
from prettyfmt import *

# Simple abbreviations of objects:
abbrev_obj({"a": "very " * 100 + "long", "b": 23})
# -> "{a='very very very very very very very very very very very very ver…', b=23}"

abbrev_obj(["word " * i for i in range(10)], field_max_len=10, list_max_len=4)
# -> "['', 'word ', 'word word ', 'word word…', …]"

# Abbreviate by character length.
abbrev_str("very " * 100 + "long", 32)
# -> 'very very very very very very v…'

# Abbreviate by character length but don't break words.
abbrev_on_words("very " * 100 + "long", 30)
# -> 'very very very very very very…'

# My favorite, abbreviate but don't break words and keep a few words
# on the end since they might be useful.
abbrev_phrase_in_middle("very " * 100 + "long", 40)
# -> 'very very very very … very very very long'

# This makes it very handy for cleaning up document titles.
ugly_title = "A  Very\tVery Very Needlessly Long  {Strange} Document Title [final edited draft23]"
# -> sanitize_title(ugly_title)
'A Very Very Very Needlessly Long Strange Document Title final edited draft23'
abbrev_phrase_in_middle(sanitize_title(ugly_title))
# -> 'A Very Very Very Needlessly Long Strange … final edited draft23'

# You can convert strings to cleaner titles:
ugly_title = "A  Very\tVery Very Needlessly Long  {Strange} Document Title [final edited draft23]"
sanitized = sanitize_title(ugly_title)
# -> 'A Very Very Very Needlessly Long Strange Document Title final edited draft23'

# Underscore and dash slugify based on this:
slugify_snake("Crème Brûlée Recipe & Notes")
# -> 'crème_brûlée_recipe_notes'

slugify_snake("Crème Brûlée Recipe & Notes", ascii=True)
# -> 'creme_brulee_recipe_notes'

slugify_kebab("你好世界 Hello World")
# -> '你好世界-hello-world'

slugify_kebab("你好世界 Hello World", ascii=True)
# -> 'ni-hao-shi-jie-hello-world'

# Formatting durations. Good for logging runtimes:
fmt_timedelta(3.33333)
# -> '3s'
fmt_timedelta(.33333)
# -> '333ms'
fmt_timedelta(.033333)
# -> '33.33ms'
fmt_timedelta(.0033333)
# -> '3.33ms'
fmt_timedelta(.00033333)
# -> '333µs'
fmt_timedelta(.000033333)
# -> '33µs'
fmt_timedelta(3333333)
# -> '39d'

# Ages in seconds or deltas.
# Note we use a sensible single numeral to keep things brief, e.g.
# "33 days ago" and not the messier "1 month and 3 days ago".
# This is important in file listings, etc, where we want to optimize
# for space and legibility.
fmt_age(60 * 60 * 24 * 33)
# -> '33 days ago'

fmt_age(60 * 60 * 24 * 33, brief=True)
# -> '33d ago'

# Use fast lazy import of the minimal pluralizer library.
plural(2, "banana")
# -> 'bananas'

# Simple plurals.
fmt_count_items(23, "banana")
# -> '23 bananas'

fmt_count_items(1, "banana")
# -> '1 banana'

# Sizes
fmt_size_human(12000000)
# -> '11.4M'

fmt_size_dual(12000000)
# -> '11.4M (12000000 bytes)'

# Helpful making __str__() methods or printing output:
fmt_words("Hello", None, "", "world!")
# -> 'Hello world!'

fmt_paras(fmt_words("Hello", "world!"), "", "Goodbye.")
# -> 'Hello world!\n\nGoodbye.'

from dataclasses import dataclass
from pathlib import Path

# Example of `abbrev_obj` to customize __str__().
# Allows sorting and truncating based on key and value.
@dataclass
class MyThing:
   file_path: Path
   title: str
   url: str
   body: str

   def __str__(self) -> str:
      return abbrev_obj(
            self,
            # Put an abbreviated title first, then the file path, then the url.
            # The `body` field will be omitted.
            key_filter={
               "title": 64,
               "file_path": 0,
               "url": 128,
            },
      )

str(MyThing(file_path="/tmp/file.txt", title="Something " + "blah " * 50, url="https://www.example.com", body="..."))
# -> "MyThing(title='Something blah blah blah blah blah blah blah blah blah blah blah…', file_path=/tmp/file.txt, url=https://www.example.com)"
```
