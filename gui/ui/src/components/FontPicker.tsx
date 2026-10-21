import { useMemo } from "react";
import { SearchSelect } from "./SearchSelect";
interface Props { id: string; label: string; value: string; fonts: string[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }
export function FontPicker({ fonts, placeholder = "系统默认", ...props }: Props) {
  const options = useMemo(() => [{ value: "", label: "系统默认" }, ...fonts.map(font => ({ value: font, label: font }))], [fonts]);
  return <SearchSelect {...props} options={options} placeholder={placeholder} searchPlaceholder="搜索本机字体…" emptyText="没有匹配的本机字体" className="font-field" />;
}
