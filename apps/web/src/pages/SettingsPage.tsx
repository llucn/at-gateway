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
      alert('设置已保存');
    },
    onError: (error: Error) => {
      alert(`保存失败: ${error.message}`);
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
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">系统设置</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Webhook 配置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                短信 Webhook URL
              </label>
              <input
                type="url"
                value={settings['webhook.smsUrl'] || ''}
                onChange={(e) => handleChange('webhook.smsUrl', e.target.value)}
                placeholder="https://example.com/webhook/sms"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                通话 Webhook URL
              </label>
              <input
                type="url"
                value={settings['webhook.callUrl'] || ''}
                onChange={(e) => handleChange('webhook.callUrl', e.target.value)}
                placeholder="https://example.com/webhook/call"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Webhook 密钥
              </label>
              <input
                type="text"
                value={settings['webhook.secret'] || ''}
                onChange={(e) => handleChange('webhook.secret', e.target.value)}
                placeholder="用于签名验证的密钥"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="webhook-enabled"
                checked={settings['webhook.enabled'] === 'true'}
                onChange={(e) => handleChange('webhook.enabled', e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="webhook-enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                启用 Webhook
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {updateMutation.isPending ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  );
}
