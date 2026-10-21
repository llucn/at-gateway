import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const MAX_SMS_LENGTH = 160;

function statusBadgeClass(status: string): string {
  if (status === 'sent' || status === 'received') return 'badge badge-green';
  if (status === 'failed') return 'badge badge-red';
  return 'badge badge-amber';
}

export default function SmsPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [content, setContent] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sms', page],
    queryFn: () => apiClient.listSms({ page, limit: 20 }),
  });

  const sendMutation = useMutation({
    mutationFn: ({ phoneNumber, content }: { phoneNumber: string; content: string }) =>
      apiClient.sendSms(phoneNumber, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms'] });
      setPhoneNumber('');
      setContent('');
      alert('SMS sent successfully');
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['sms'] });
      alert(`Send failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate({ phoneNumber, content });
  };

  const charsLeft = MAX_SMS_LENGTH - content.length;
  const charCountColor = charsLeft < 0 ? 'var(--red)' : charsLeft < 20 ? 'var(--amber)' : 'var(--muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>SMS</h1>

      {/* Send form card */}
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
          Send SMS
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Phone number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="phone" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+86xxxxxxxxxxx"
                required
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

            {/* SMS content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="content" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Message
                </label>
                <span style={{ fontSize: 12, color: charCountColor, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {content.length} / {MAX_SMS_LENGTH}
                </span>
              </div>
              <textarea
                id="content"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '8px 12px',
                  outline: 'none',
                  width: '100%',
                  resize: 'vertical',
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1.6,
                  transition: 'border-color var(--transition-fast)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={sendMutation.isPending}
                className="btn btn-primary"
              >
                {sendMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Records card */}
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
          SMS History
        </div>

        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {data?.data?.map((sms: any) => (
                <li key={sms.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          {sms.phoneNumber}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {sms.direction === 'inbound' ? 'Received' : 'Sent'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                        {sms.content}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {new Date(sms.createdAt).toLocaleString('en-US')}
                      </span>
                    </div>
                    <span className={statusBadgeClass(sms.status)} style={{ flexShrink: 0 }}>
                      {sms.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div style={{
              padding: '10px 20px',
              background: 'var(--card2)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Page {page} / {data?.pagination?.totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.pagination?.totalPages || 1)}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
