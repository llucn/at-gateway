const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

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
}

export const apiClient = new ApiClient(API_BASE_URL);
