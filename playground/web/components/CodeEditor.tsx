import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, type KeyBinding, keymap } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { type BasicSetupOptions } from "@uiw/react-codemirror";
import { useMemo } from "react";
import { usePrefersDark } from "../lib/theme.ts";

export type EditorLanguage = "py" | "ts" | "md";

/** "Interview mode": the basic setup without anything that suggests or judges code. */
export const BASIC_SETUP: BasicSetupOptions = {
  autocompletion: false,
  completionKeymap: false,
  lintKeymap: false,
  foldGutter: false,
  foldKeymap: false,
};

function language(lang: EditorLanguage): Extension {
  if (lang === "py") return python();
  if (lang === "ts") return javascript({ typescript: true });
  return [markdown(), EditorView.lineWrapping];
}

interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  lang: EditorLanguage;
  /** Checked before CodeMirror's defaults (its Mod-Enter would insert a blank line). Keep the array stable. */
  bindings?: readonly KeyBinding[];
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
}

const NO_BINDINGS: readonly KeyBinding[] = [];

export function CodeEditor({ value, onChange, lang, bindings = NO_BINDINGS, ariaLabel, className, autoFocus }: CodeEditorProps) {
  const dark = usePrefersDark();
  const extensions = useMemo(
    () => [
      language(lang),
      // Keep the browser from adding its own help (spellcheck, autocorrect, writing suggestions).
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
        writingsuggestions: "false",
      }),
      Prec.highest(keymap.of(bindings)),
    ],
    [lang, ariaLabel, bindings],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{ ...BASIC_SETUP, tabSize: lang === "py" ? 4 : 2 }}
      theme={dark ? githubDark : githubLight}
      height="100%"
      className={className}
      autoFocus={autoFocus}
      indentWithTab
    />
  );
}
