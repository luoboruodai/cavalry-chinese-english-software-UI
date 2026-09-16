import type { ReactNode } from "react";

interface Props {
  title: string;
  desc: string;
  action?: ReactNode;
}

/** 统一的区标题行:15px/500 标题(+右侧可选操作)+ 12px #80827f 描述。 */
export function SectionHeader({ title, desc, action }: Props) {
  return (
    <div className="section-head">
      <div className="section-head-row">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      <p className="section-desc">{desc}</p>
    </div>
  );
}
