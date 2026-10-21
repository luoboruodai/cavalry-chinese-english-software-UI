import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface SelectOption { value: string; label: string; detail?: string }
interface Props {
  id: string; label: string; value: string; options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string; searchPlaceholder?: string; emptyText?: string;
  disabled?: boolean; hideLabel?: boolean; className?: string;
}

/** Shared single-field picker for both installed Cavalry versions and fonts. */
export function SearchSelect({ id, label, value, options, onChange, placeholder = "请选择", searchPlaceholder = "搜索…", emptyText = "没有匹配的选项", disabled = false, hideLabel = false, className = "" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [side, setSide] = useState<"top" | "bottom">("bottom");
  const selected = options.find(option => option.value === value);
  const matches = useMemo(() => options.filter(option => `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [options, query]);
  const close = () => { setOpen(false); setQuery(""); };
  const show = (fromKeyboard = false) => {
    if (disabled || open) return;
    setKeyboard(fromKeyboard); setQuery("");
    setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true);
  };
  const choose = (next: string) => { onChange(next); close(); input.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = (event?: Event) => {
      // Scrolling the options must not reposition or scroll the page behind them.
      if (event?.target instanceof Node && popup.current?.contains(event.target)) return;
      const anchor = input.current;
      if (!anchor) return;
      if (disabled || anchor.matches(":disabled")) { close(); return; }
      const rect = anchor.getBoundingClientRect();
      const content = anchor.closest<HTMLElement>(".content")?.getBoundingClientRect();
      const footer = anchor.closest<HTMLElement>(".type-view")?.querySelector<HTMLElement>(".settings-footer");
      const footerTop = footer?.getClientRects().length ? footer.getBoundingClientRect().top : window.innerHeight;
      const top = Math.max(12, (content?.top ?? 0) + 8);
      const bottom = Math.min(window.innerHeight - 12, (content?.bottom ?? window.innerHeight) - 8, footerTop - 8);
      // A portaled list must not survive after its field scrolls behind the toolbar/save bar.
      if (!anchor.getClientRects().length || rect.top < top || rect.bottom > bottom) { close(); return; }
      const below = Math.max(0, bottom - rect.bottom - 6);
      const above = Math.max(0, rect.top - top - 6);
      // Prefer a compact downward list, not the side with room for the longest list.
      // Short/filtered lists need only their actual height; long lists need at least two readable rows.
      const naturalHeight = Math.min(264, (popup.current?.scrollHeight ?? 252) + 2);
      const usefulHeight = Math.min(108, naturalHeight);
      const up = below < usefulHeight && above > below;
      if (Math.max(above, below) < 44) { close(); return; }
      const width = Math.min(rect.width, window.innerWidth - 24);
      setSide(up ? "top" : "bottom");
      setPosition({ position: "fixed", left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight: Math.min(naturalHeight, up ? above : below), transformOrigin: up ? "bottom center" : "top center", ...(up ? { top: "auto", bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6, bottom: "auto" }) });
    };
    place(); window.addEventListener("resize", place); document.addEventListener("scroll", place, true);
    const resize = new ResizeObserver(() => place());
    if (input.current) resize.observe(input.current);
    const footer = input.current?.closest(".type-view")?.querySelector(".settings-footer");
    if (footer) resize.observe(footer);
    return () => { resize.disconnect(); window.removeEventListener("resize", place); document.removeEventListener("scroll", place, true); };
  }, [open, matches.length, disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useLayoutEffect(() => {
    const list = popup.current;
    const option = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !option) return;
    const box = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (box.top < bounds.top + 5) list.scrollTop -= bounds.top + 5 - box.top;
    else if (box.bottom > bounds.bottom - 5) list.scrollTop += box.bottom - bounds.bottom + 5;
  }, [active, open]);
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show(true); else setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter" && open) {
      event.preventDefault(); if (matches[active]) choose(matches[active].value);
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault(); setActive(event.key === "Home" ? 0 : Math.max(0, matches.length - 1));
    } else if (event.key === "Tab") close();
  };
  return <div ref={root} className={`field select-field ${className}`}>
    <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>{label}</label>
    <div className="select-control font-combobox">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined} disabled={disabled} title={!open ? selected?.label : undefined} autoComplete="off" placeholder={open ? searchPlaceholder : placeholder} value={open ? query : value === "" ? "" : (selected?.label ?? value)} onClick={() => show()} onChange={event => { setKeyboard(true); setOpen(true); setQuery(event.target.value); setActive(0); }} onKeyDown={keys} onBlur={close} />
      <span className={`font-arrow ${open ? "open" : ""}`} data-side={open ? side : "bottom"}><Icon name="chevron" /></span>
    </div>
    {open && createPortal(<div ref={popup} id={listId} role="listbox" aria-label={`${label}选项`} className="select-options font-options" data-keyboard={keyboard} data-side={side} style={position}>
      {matches.length ? matches.map((option, index) => <div key={option.value} role="option" id={`${listId}-${index}`} aria-selected={value === option.value} data-active={active === index} className="select-option font-option" onMouseDown={event => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(option.value)}>
        <span className="option-copy"><span>{option.label}</span>{option.detail && <span className="option-detail">{option.detail}</span>}</span>{value === option.value && <Icon name="check" />}
      </div>) : <p className="font-no-results">{emptyText}</p>}
    </div>, document.body)}
  </div>;
}
