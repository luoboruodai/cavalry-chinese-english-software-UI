interface Props {
  variant: "applied" | "idle";
  width?: number;
}

const INK = "#2c2e2a";

/**
 * MindMarket 纸剪风平面插画(纯手写 SVG,无图标库/照片/渐变):
 * 奶油底上直接放的平面色块角色 —— 圆角色 + 三角旗 + 四角星 + 圆点。
 * applied:绿角色 + 珊瑚/蓝旗 + 黄星(欢快);idle:灰调版本(待命中)。
 */
export function PaperArt({ variant, width = 140 }: Props) {
  const applied = variant === "applied";
  const blob = applied ? "#8ed462" : "#d5d5d4";
  const flagA = applied ? "#ff705d" : "#e0dbce";
  const flagB = applied ? "#2ba0ff" : "#e0dbce";
  const star = applied ? "#f5e211" : "#e0dbce";
  const dot = applied ? "#2ba0ff" : "#d5d5d4";
  const height = Math.round((width / 150) * 104);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 150 104"
      fill="none"
      role="img"
      aria-label={applied ? "已就绪的插画角色" : "待命的插画角色"}
    >
      {/* 圆角色 */}
      <circle cx="40" cy="64" r="25" fill={blob} stroke={INK} strokeWidth="3.5" />
      {applied ? (
        <>
          <circle cx="32" cy="59" r="5" fill="#ffffff" />
          <circle cx="48" cy="59" r="5" fill="#ffffff" />
          <circle cx="33.5" cy="60" r="2.2" fill={INK} />
          <circle cx="49.5" cy="60" r="2.2" fill={INK} />
          <path
            d="M31 71 Q40 79 49 71"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M28 60 L36 60 M44 60 L52 60"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M36 73 L44 73" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {/* 旗杆 + 三角旗 */}
      <line
        x1="40"
        y1="39"
        x2="106"
        y2="15"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M64 30 L92 24 L68 44 Z"
        fill={flagA}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M88 22 L116 16 L92 36 Z"
        fill={flagB}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 四角星 + 圆点 */}
      <path
        d="M124 34 L127.5 41 L134 44 L127.5 47 L124 54 L120.5 47 L114 44 L120.5 41 Z"
        fill={star}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="28" r="4" fill={dot} stroke={INK} strokeWidth="2.5" />
    </svg>
  );
}
