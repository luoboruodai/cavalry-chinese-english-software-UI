"""ICU MessageFormat argument/branch contract for Cavalry 2.8 catalog candidates.

Not a message formatter. Literal text may change/reorder; argument names, types,
styles, branch selectors, offsets and plural # counts must survive translation.
"""
from collections import Counter
import re


class MessageSyntaxError(ValueError):
    pass


class _Parser:
    def __init__(self, text):
        self.text, self.pos = text, 0

    def spaces(self):
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def expect(self, character):
        self.spaces()
        if self.pos >= len(self.text) or self.text[self.pos] != character:
            raise MessageSyntaxError(f"Expected {character!r} at {self.pos}")
        self.pos += 1

    def quoted(self, in_plural):
        """ICU apostrophe-friendly syntax: only syntax characters start quoting."""
        self.pos += 1
        if self.pos < len(self.text) and self.text[self.pos] == "'":
            self.pos += 1
            return
        syntax = "{}#" if in_plural else "{}"
        if self.pos >= len(self.text) or self.text[self.pos] not in syntax:
            return
        while self.pos < len(self.text):
            if self.text[self.pos] == "'":
                self.pos += 1
                if self.pos < len(self.text) and self.text[self.pos] == "'":
                    self.pos += 1
                    continue
                return
            self.pos += 1
        # ICU auto-closes an apostrophe quote at the end of the pattern.

    def message(self, nested=False, in_plural=False):
        arguments = []
        while self.pos < len(self.text):
            character = self.text[self.pos]
            if character == "'":
                self.quoted(in_plural)
            elif character == "{":
                arguments.append(self.argument(in_plural))
            elif character == "}":
                if not nested:
                    raise MessageSyntaxError(f"Unmatched closing brace at {self.pos}")
                self.pos += 1
                break
            else:
                if character == "#" and in_plural:
                    arguments.append(("plural-number",))
                self.pos += 1
        else:
            if nested:
                raise MessageSyntaxError("Unclosed message branch")
        return tuple(sorted(Counter(arguments).items(), key=lambda item: repr(item[0])))

    def argument(self, in_plural):
        self.expect("{")
        self.spaces()
        match = re.match(r"(?:[0-9]+|[A-Za-z_][A-Za-z0-9_]*)", self.text[self.pos:])
        if not match:
            raise MessageSyntaxError(f"Invalid argument at {self.pos}")
        name = match.group()
        self.pos += len(name)
        self.spaces()
        if self.pos < len(self.text) and self.text[self.pos] == "}":
            self.pos += 1
            return ("argument", name, "simple")
        self.expect(",")
        self.spaces()
        match = re.match(r"[A-Za-z]+", self.text[self.pos:])
        if not match:
            raise MessageSyntaxError(f"Missing argument type at {self.pos}")
        kind = match.group()
        self.pos += len(kind)
        if kind not in ("plural", "select", "selectordinal"):
            # Supported ICU scalar styles do not contain nested message branches.
            if kind not in ("number", "date", "time", "spellout", "ordinal", "duration"):
                raise MessageSyntaxError(f"Unsupported ICU argument type: {kind}")
            self.spaces()
            start = self.pos
            while self.pos < len(self.text) and self.text[self.pos] != "}":
                if self.text[self.pos] == "{":
                    raise MessageSyntaxError("Nested braces in scalar argument style")
                if self.text[self.pos] == "'":
                    self.quoted(False)
                else:
                    self.pos += 1
            style = self.text[start:self.pos].strip()
            if style and not style.startswith(","):
                raise MessageSyntaxError("Missing comma before scalar style")
            self.expect("}")
            return ("argument", name, kind, style)
        self.expect(",")
        self.spaces()
        offset = "0"
        if self.text.startswith("offset:", self.pos):
            if kind == "select":
                raise MessageSyntaxError("select does not accept a plural offset")
            self.pos += len("offset:")
            self.spaces()
            match = re.match(r"[0-9]+(?:\.[0-9]+)?", self.text[self.pos:])
            if not match:
                raise MessageSyntaxError("Invalid plural offset")
            offset = match.group()
            self.pos += len(offset)
        branches = {}
        while True:
            self.spaces()
            if self.pos < len(self.text) and self.text[self.pos] == "}":
                self.pos += 1
                break
            match = re.match(r"(?:=-?[0-9]+(?:\.[0-9]+)?|[A-Za-z_][A-Za-z0-9_-]*)", self.text[self.pos:])
            if not match:
                raise MessageSyntaxError(f"Missing branch selector at {self.pos}")
            selector = match.group()
            self.pos += len(selector)
            if selector in branches:
                raise MessageSyntaxError(f"Duplicate branch selector: {selector}")
            if kind != "select" and not selector.startswith("=") and selector not in (
                    "zero", "one", "two", "few", "many", "other"):
                raise MessageSyntaxError(f"Invalid plural selector: {selector}")
            self.expect("{")
            branches[selector] = self.message(nested=True, in_plural=in_plural or kind != "select")
        if "other" not in branches:
            raise MessageSyntaxError("ICU branch argument requires other")
        return ("argument", name, kind, offset, tuple(sorted(branches.items())))


def message_contract(text):
    if not isinstance(text, str) or not text:
        raise MessageSyntaxError("Message must be a nonempty string")
    return _Parser(text).message()


def validate_translation(source, translation):
    if message_contract(source) != message_contract(translation):
        raise MessageSyntaxError("ICU arguments, types, branch selectors, offsets or # counts changed")
