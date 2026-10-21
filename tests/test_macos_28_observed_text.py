"""Static guard for the reviewed 2.8 custom-painted text repair surface."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INJECTOR = ROOT / "injector/CavalryTranslatorInjector.mm"
PATH_SOURCE = ROOT / "injector/cavalry_i18n_macos_tool_help_text_path.cpp"


class MacOS28ObservedTextTests(unittest.TestCase):
    def test_v6_rect_hook_and_reviewed_literals_remain_present(self):
        source = INJECTOR.read_text(encoding="utf-8")
        for literal in (
            "Select layers to see their settings",
            "Use the Create menu to add a Layer to the active Composition",
            "Search Layers...",
            "Enter an Attribute name",
            "Enter a Layer name",
        ):
            self.assertIn(literal, source)
        self.assertIn("replacementQPainterDrawRectText", source)
        self.assertIn("__ZN8QPainter8drawTextERK5QRectiRK7QStringPS0_", source)
        self.assertIn("dyld_dynamic_interpose", source)

    def test_rectf_int_empty_state_hook_forwards_to_original_qtgui_export(self):
        source = INJECTOR.read_text(encoding="utf-8")
        self.assertIn("replacementQPainterDrawRectFText", source)
        self.assertIn("__ZN8QPainter8drawTextERK6QRectFiRK7QStringPS0_", source)
        self.assertIn("originalQPainterDrawRectFText", source)
        self.assertIn("resolveQtGuiTextSymbol", source)
        self.assertIn("mach_header_64", source)
        self.assertIn("LC_SYMTAB", source)
        self.assertIn("nlist_64", source)
        self.assertNotIn("dlsym(handle", source)
        self.assertIn("installDynamicTextInterpose", source)
        self.assertNotIn("installDynamicRectTextInterpose", source)

    def test_28_default_path_font_and_bounded_retry_remain_guarded(self):
        source = PATH_SOURCE.read_text(encoding="utf-8")
        self.assertIn('defaultFamily = "Hiragino Sans GB"', source)
        self.assertIn("gState.vendorContractVerified", source)
        self.assertIn("gState.rendererReady", source)
        injector = INJECTOR.read_text(encoding="utf-8")
        self.assertIn("kMaxToolPathConfigurationAttempts = 240", injector)


if __name__ == "__main__":
    unittest.main()
