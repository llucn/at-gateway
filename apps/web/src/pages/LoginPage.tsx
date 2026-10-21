import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../lib/auth-store';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login(username, password);
      setTokens(response.accessToken, response.refreshToken, response.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '36px',
        animation: 'fadeUp 0.35s ease both',
      }}>
        {/* Logo / Title */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}>
            ATG
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Voice &amp; SMS Gateway
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              fontSize: 13,
              color: 'var(--red)',
              padding: '8px 12px',
              background: 'var(--red-dim)',
              borderRadius: 8,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="username" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                background: 'var(--card)',
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                background: 'var(--card)',
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '10px',
              fontSize: 14,
              fontWeight: 600,
              background: loading ? 'var(--muted)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'filter 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
