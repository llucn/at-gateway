const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private baseURL: string;

  // Shared promise while a token refresh is in-flight, so concurrent 401s
  // only trigger one refresh request instead of N parallel ones.
  private refreshingPromise: Promise<string> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const accessToken = token ?? localStorage.getItem('accessToken');
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  /** Attempt to refresh the access token.  Returns the new access token. */
  private async doRefresh(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json();
    const newAccess: string = data.accessToken;
    const newRefresh: string = data.refreshToken ?? refreshToken;

    // Persist to both storage locations used by auth-store
    localStorage.setItem('accessToken', newAccess);
    localStorage.setItem('refreshToken', newRefresh);

    // Also update the Zustand persisted store so the UI stays in sync
    try {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state) {
          parsed.state.accessToken = newAccess;
          parsed.state.refreshToken = newRefresh;
          localStorage.setItem('auth-storage', JSON.stringify(parsed));
        }
      }
    } catch { /* ignore */ }

    return newAccess;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    _retry = false,
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    // Auto-refresh on 401, but only once per original request
    if (response.status === 401 && !_retry) {
      try {
        // Coalesce concurrent refreshes into a single in-flight promise
        if (!this.refreshingPromise) {
          this.refreshingPromise = this.doRefresh().finally(() => {
            this.refreshingPromise = null;
          });
        }
        const newToken = await this.refreshingPromise;

        // Retry the original request with the new token
        const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            ...this.getHeaders(newToken),
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ message: 'Request failed' }));
          throw new Error(error.message || `HTTP ${retryResponse.status}`);
        }

        return retryResponse.json();
      } catch {
        // Refresh failed — clear auth state and force re-login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.state) {
              parsed.state.accessToken = null;
              parsed.state.refreshToken = null;
              parsed.state.isAuthenticated = false;
              parsed.state.user = null;
              localStorage.setItem('auth-storage', JSON.stringify(parsed));
            }
          }
        } catch { /* ignore */ }
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<any>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Status
  async getStatus() {
    return this.request<any>('/status');
  }

  // SMS
  async sendSms(phoneNumber: string, content: string) {
    return this.request<any>('/sms', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, content }),
    });
  }

  async listSms(query?: any) {
    const params = new URLSearchParams(query);
    return this.request<any>(`/sms?${params}`);
  }

  async getSms(id: string) {
    return this.request<any>(`/sms/${id}`);
  }

  // Calls
  async makeCall(phoneNumber: string, ttsMessage?: string) {
    return this.request<any>('/calls', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, ttsMessage }),
    });
  }

  async hangupCall(id: string) {
    return this.request<any>(`/calls/${id}/hangup`, {
      method: 'POST',
    });
  }

  async listCalls(query?: any) {
    const params = new URLSearchParams(query);
    return this.request<any>(`/calls?${params}`);
  }

  async getCall(id: string) {
    return this.request<any>(`/calls/${id}`);
  }

  // Recordings
  async listRecordings(query?: any) {
    const params = new URLSearchParams(query);
    return this.request<any>(`/recordings?${params}`);
  }

  async getRecording(id: string) {
    return this.request<any>(`/recordings/${id}`);
  }

  // Settings
  async getSettings() {
    return this.request<any>('/settings');
  }

  async updateSettings(updates: Record<string, string>) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Credentials
  async createCredential(expiryDays: number | null, name?: string) {
    return this.request<any>('/credentials', {
      method: 'POST',
      body: JSON.stringify({ expiryDays, name }),
    });
  }

  async listCredentials() {
    return this.request<any>('/credentials');
  }

  async revokeCredential(id: string) {
    return this.request<any>(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
