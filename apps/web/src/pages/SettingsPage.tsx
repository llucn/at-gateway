import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  // Update local state when data changes
  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, string>) => apiClient.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Settings saved');
    },
    onError: (error: Error) => {
      alert(`Save failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
        System Settings
      </h1>

      <div className="card">
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
          Webhook Configuration
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* SMS Webhook URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="sms-url" style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                SMS Webhook URL
              </label>
              <input
                type="url"
                id="sms-url"
                value={settings['webhook.smsUrl'] || ''}
                onChange={(e) => handleChange('webhook.smsUrl', e.target.value)}
                placeholder="https://example.com/webhook/sms"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '8px 12px',
                  outline: 'none',
                  width: '100%',
                  transition: 'border-color var(--transition-fast)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Call Webhook URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="call-url" style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Call Webhook URL
              </label>
              <input
                type="url"
                id="call-url"
                value={settings['webhook.callUrl'] || ''}
                onChange={(e) => handleChange('webhook.callUrl', e.target.value)}
                placeholder="https://example.com/webhook/call"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '8px 12px',
                  outline: 'none',
                  width: '100%',
                  transition: 'border-color var(--transition-fast)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Webhook Secret */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="secret" style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Webhook Secret
              </label>
              <input
                type="text"
                id="secret"
                value={settings['webhook.secret'] || ''}
                onChange={(e) => handleChange('webhook.secret', e.target.value)}
                placeholder="Secret key for signature verification"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '8px 12px',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  transition: 'border-color var(--transition-fast)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Enable Webhook Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="webhook-enabled"
                checked={settings['webhook.enabled'] === 'true'}
                onChange={(e) => handleChange('webhook.enabled', e.target.checked ? 'true' : 'false')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="webhook-enabled" style={{
                fontSize: 13,
                color: 'var(--text)',
                cursor: 'pointer',
                userSelect: 'none'
              }}>
                Enable Webhook
              </label>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn btn-primary"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
