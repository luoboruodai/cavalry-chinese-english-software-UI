"""Test bootstrap for local tool modules used by Cavalry 2.8 audit tests."""
from pathlib import Path
import sys

_tools = str(Path(__file__).resolve().parent.parent / "tools")
if _tools not in sys.path:
    sys.path.insert(0, _tools)
