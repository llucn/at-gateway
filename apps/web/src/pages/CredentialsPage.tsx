import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function CredentialsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [newCredential, setNewCredential] = useState<any>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => apiClient.listCredentials(),
  });

  const createMutation = useMutation({
    mutationFn: ({ expiryDays, name }: { expiryDays: number | null; name?: string }) =>
      apiClient.createCredential(expiryDays, name),
    onSuccess: (data) => {
      setNewCredential(data);
      setShowCreateModal(false);
      setShowSecretModal(true);
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (error: Error) => {
      alert(`Failed to create credential: ${error.message}`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.revokeCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setRevokeId(null);
      alert('Credential revoked successfully');
    },
    onError: (error: Error) => {
      alert(`Failed to revoke credential: ${error.message}`);
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          API Credentials
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create New Credential
        </button>
      </div>

      {/* Credentials list */}
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
          Credentials
        </div>

        {!credentials || credentials.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No credentials yet. Create one to get started.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {credentials.map((cred: any) => (
              <li key={cred.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Name and status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {cred.name || 'Unnamed'}
                      </span>
                      <span className={cred.isActive ? 'badge badge-green' : 'badge badge-red'}>
                        {cred.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                    {cred.isActive && (
                      <button
                        onClick={() => setRevokeId(cred.id)}
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>

                  {/* API Key */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>API Key:</span>
                    <code style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text)',
                      background: 'var(--bg)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      flex: 1,
                    }}>
                      {cred.apiKey}
                    </code>
                    <button
                      onClick={() => handleCopy(cred.apiKey)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '4px 8px',
                      }}
                    >
                      Copy
                    </button>
                  </div>

                  {/* API Secret (masked) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>API Secret:</span>
                    <code style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--muted)',
                      background: 'var(--bg)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      flex: 1,
                    }}>
                      {cred.apiSecret}
                    </code>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)' }}>
                    <span>Created: {formatDate(cred.createdAt)}</span>
                    <span>Expires: {formatDate(cred.expiresAt)}</span>
                    <span>Last Used: {formatDate(cred.lastUsedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create Modal - Placeholder for next chunk */}
      {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} onCreate={createMutation.mutate} />}

      {/* Secret Modal - Placeholder for next chunk */}
      {showSecretModal && newCredential && (
        <SecretModal credential={newCredential} onClose={() => { setShowSecretModal(false); setNewCredential(null); }} />
      )}

      {/* Revoke Confirmation - Placeholder for next chunk */}
      {revokeId && (
        <RevokeConfirmation onConfirm={() => revokeMutation.mutate(revokeId)} onCancel={() => setRevokeId(null)} />
      )}
    </div>
  );
}

// Create Modal Component
function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState('');
  const [expiryDays, setExpiryDays] = useState<number | null>(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ expiryDays, name: name || undefined });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, margin: 16 }}>
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
          Create New Credential
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Key"
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

            {/* Expiry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                Expires In
              </label>
              <select
                value={expiryDays === null ? 'never' : expiryDays}
                onChange={(e) => setExpiryDays(e.target.value === 'never' ? null : Number(e.target.value))}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '8px 12px',
                  outline: 'none',
                  width: '100%',
                  cursor: 'pointer',
                }}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="180">180 days</option>
                <option value="360">360 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Secret Modal Component
function SecretModal({ credential, onClose }: { credential: any; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 560, margin: 16 }}>
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
          Credential Created Successfully
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: 12,
            background: 'var(--amber)',
            color: '#000',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: 500,
          }}>
            ⚠️ Save your API Secret now. You won't be able to see it again!
          </div>

          {/* API Key */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>API Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                background: 'var(--bg)',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                flex: 1,
                wordBreak: 'break-all',
              }}>
                {credential.apiKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(credential.apiKey);
                  alert('API Key copied!');
                }}
                className="btn btn-secondary"
              >
                Copy
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>API Secret</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                background: 'var(--bg)',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                flex: 1,
                wordBreak: 'break-all',
              }}>
                {credential.apiSecret}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(credential.apiSecret);
                  alert('API Secret copied!');
                }}
                className="btn btn-secondary"
              >
                Copy
              </button>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
            I've Saved My Secret
          </button>
        </div>
      </div>
    </div>
  );
}

// Revoke Confirmation Component
function RevokeConfirmation({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, margin: 16 }}>
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
          Confirm Revocation
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            Are you sure you want to revoke this credential? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={onConfirm} className="btn btn-primary" style={{ background: 'var(--red)' }}>
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
