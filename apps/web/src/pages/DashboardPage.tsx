import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { lookupPlmn } from '../lib/mcc-mnc';

/** Resolve a 5-digit PLMN string (MCC+MNC) to country + operator names */
function resolvePlmn(plmn: string | undefined): { country: string; operator: string } | null {
  if (!plmn) return null;
  return lookupPlmn(plmn.replace(/\D/g, ''));
}

// ── Signal helpers ──────────────────────────────────────────────────────────

/** Map RSSI (dBm) to 0-4 bars */
function rssiToBars(rssi: number | null | undefined): number {
  if (rssi == null) return 0;
  if (rssi >= -65) return 4;
  if (rssi >= -75) return 3;
  if (rssi >= -85) return 2;
  if (rssi >= -95) return 1;
  return 0;
}

function rssiToLabel(rssi: number | null | undefined): string {
  if (rssi == null) return '未知';
  if (rssi >= -65) return '极好';
  if (rssi >= -75) return '良好';
  if (rssi >= -85) return '一般';
  if (rssi >= -95) return '较弱';
  return '极弱';
}

function rssiToColor(rssi: number | null | undefined): string {
  if (rssi == null) return 'var(--muted)';
  if (rssi >= -75) return 'var(--green)';
  if (rssi >= -85) return 'var(--amber)';
  return 'var(--red)';
}

/** 4-bar signal icon; filled bars determined by `bars` (0-4) */
function SignalIcon({ bars, color }: { bars: number; color: string }) {
  const heights = [6, 10, 14, 18]; // px height per bar
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden="true">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 7}
          y={20 - h}
          width={5}
          height={h}
          rx="1"
          fill={i < bars ? color : 'var(--border)'}
        />
      ))}
    </svg>
  );
}

// ── Network status label ────────────────────────────────────────────────────

function networkLabel(status: string | undefined): string {
  switch (status) {
    case 'REGISTERED_HOME':    return '已注册（本地）';
    case 'REGISTERED_ROAMING': return '已注册（漫游）';
    case 'NOT_REGISTERED':     return '未注册';
    case 'SEARCHING':          return '搜索中';
    case 'DENIED':             return '被拒绝';
    default:                   return status || '未知';
  }
}

function networkColor(status: string | undefined): string {
  if (status === 'REGISTERED_HOME' || status === 'REGISTERED_ROAMING') return 'var(--green)';
  if (status === 'SEARCHING') return 'var(--amber)';
  return 'var(--red)';
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatRevision(rev: string | undefined): string {
  if (!rev) return 'N/A';
  // Strip leading "+CGMR: " prefix if present
  return rev.replace(/^\+CGMR:\s*/i, '');
}

function formatLastUpdated(ts: string | undefined): string {
  if (!ts) return '未知';
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ── Small UI primitives ─────────────────────────────────────────────────────

function StatusDot({ on }: { on: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: on ? 'var(--green)' : 'var(--red)',
      boxShadow: on ? '0 0 6px var(--green)' : 'none',
      flexShrink: 0,
    }} />
  );
}

interface MetaRowProps { label: string; value: React.ReactNode; mono?: boolean }
function MetaRow({ label, value, mono }: MetaRowProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      gap: 12,
    }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

interface CardProps { title: string; children: React.ReactNode }
function SectionCard({ title, children }: CardProps) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card2)',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {title}
      </div>
      <div style={{ padding: '4px 18px 12px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: status, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['status'],
    queryFn: () => apiClient.getStatus(),
    refetchInterval: 10000,
  });

  const plmnInfo = resolvePlmn(status?.operator);
  const rssi  = status?.signalQuality?.rssi;
  const rsrp  = status?.signalQuality?.rsrp;
  const rsrq  = status?.signalQuality?.rsrq;
  const ber   = status?.signalQuality?.ber;
  const bars  = rssiToBars(rssi);
  const sigColor = rssiToColor(rssi);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>系统状态</h1>
        {dataUpdatedAt > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            最后刷新：{new Date(dataUpdatedAt).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>

      {isLoading && (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>加载中…</div>
      )}

      {/* Status summary bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 1,
        background: 'var(--border)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Modem state */}
        <div style={{ background: 'var(--card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>调制解调器</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot on={status?.state === 'connected'} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {status?.state === 'connected' ? '已连接' : status?.state ?? '—'}
            </span>
          </div>
        </div>

        {/* SIM */}
        <div style={{ background: 'var(--card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>SIM 卡</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot on={status?.simStatus === 'READY'} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {status?.simStatus === 'READY' ? '正常' : status?.simStatus ?? '—'}
            </span>
          </div>
        </div>

        {/* Network */}
        <div style={{ background: 'var(--card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>网络</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: networkColor(status?.networkStatus) }}>
            {networkLabel(status?.networkStatus)}
          </span>
        </div>

        {/* Operator */}
        <div style={{ background: 'var(--card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>运营商</div>
          {plmnInfo ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{plmnInfo.operator}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{plmnInfo.country}</div>
            </div>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {status?.operator ?? '—'}
            </span>
          )}
        </div>

        {/* Signal */}
        <div style={{ background: 'var(--card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>信号强度</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SignalIcon bars={bars} color={sigColor} />
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: sigColor }}>
                {rssi != null ? `${rssi} dBm` : '—'}
              </span>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{rssiToLabel(rssi)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Signal quality detail */}
        <SectionCard title="信号质量">
          <MetaRow label="RSSI" value={rssi != null ? `${rssi} dBm` : 'N/A'} mono />
          <MetaRow label="RSRP" value={rsrp != null ? `${rsrp} dBm` : 'N/A'} mono />
          <MetaRow label="RSRQ" value={rsrq != null ? `${rsrq} dB` : 'N/A'} mono />
          <MetaRow label="BER" value={ber != null ? String(ber) : 'N/A'} mono />
        </SectionCard>

        {/* Device info */}
        <SectionCard title="设备信息">
          <MetaRow label="制造商" value={status?.manufacturer ?? 'N/A'} />
          <MetaRow label="型号"   value={status?.model ?? 'N/A'} mono />
          <MetaRow label="固件"   value={formatRevision(status?.revision)} mono />
        </SectionCard>

        {/* SIM / identity */}
        <SectionCard title="SIM / 标识">
          <MetaRow label="IMEI" value={status?.imei ?? 'N/A'} mono />
          <MetaRow label="IMSI" value={status?.imsi ?? 'N/A'} mono />
          <MetaRow label="最后更新" value={formatLastUpdated(status?.lastUpdated)} />
        </SectionCard>
      </div>
    </div>
  );
}
