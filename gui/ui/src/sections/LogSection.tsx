import type { LogEntry } from "../App";
import { SectionHeader } from "../SectionHeader";
import { EmptyState } from "../EmptyState";

interface Props {
  logs: LogEntry[];
}

export function LogSection({ logs }: Props) {
  return (
    <>
      <SectionHeader title="日志" desc="最近的应用、还原与配置变更记录。" />
      <div className="card">
        {logs.length === 0 ? (
          <EmptyState text="尚无操作记录" />
        ) : (
          <div className="log-rows">
            {logs.map((entry, index) => (
              <div className="log-row" key={`${entry.time}-${index}`}>
                <span className="t">{entry.time}</span>
                <span className="m">{entry.text}</span>
              </div>
            ))}
          </div>
        )}
        <p className="log-note">
          应用与还原均通过 cbpatch 核心库执行；所有备份保存在
          ~/.cavalry-bilingual/backups。执行操作前请退出 Cavalry 并保存好工作。
        </p>
      </div>
    </>
  );
}
