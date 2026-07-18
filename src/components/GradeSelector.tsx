import { fontFamilies } from '../theme';

// 通用段位选择器：value 类型支持 number（小学 1-12）和 string（初中 '7a'-'9b'）。
// 两类段位 UI 完全一致，仅值类型不同；用泛型 prop 一次覆盖。
interface Props<T extends number | string> {
  bands: readonly { value: T; label: string }[];
  value: T;
  onChange: (band: T) => void;
}

export function GradeSelector<T extends number | string>({ bands, value, onChange }: Props<T>) {
  return (
    <div style={{ margin: '0 auto 18px', maxWidth: 920 }}>
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '2px 2px 8px',
        justifyContent: 'center',
      }}>
        {bands.map((band) => {
          const active = band.value === value;
          return (
            <button
              key={band.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(band.value)}
              style={{
                flex: '0 0 auto',
                minWidth: 52,
                height: 38,
                padding: '0 12px',
                borderRadius: 4,
                border: active ? '2px solid #d4af6a' : '2px solid rgba(216,224,240,0.22)',
                background: active ? '#a8302a' : 'rgba(216,224,240,0.08)',
                color: active ? '#f5ebd2' : 'rgba(216,224,240,0.72)',
                fontFamily: fontFamilies.chinese,
                fontSize: 18,
                fontWeight: 700,
                boxShadow: active ? '0 0 14px rgba(212,175,106,0.45)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {band.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
