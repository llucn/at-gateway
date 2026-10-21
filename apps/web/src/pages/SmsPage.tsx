import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

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
      alert('短信发送成功');
    },
    onError: (error: Error) => {
      alert(`发送失败: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate({ phoneNumber, content });
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">短信管理</h1>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">发送短信</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              手机号码
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+86xxxxxxxxxxx"
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              短信内容
            </label>
            <textarea
              id="content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {sendMutation.isPending ? '发送中...' : '发送'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">短信记录</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-center">加载中...</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.data?.map((sms: any) => (
                <li key={sms.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {sms.direction === 'inbound' ? '接收' : '发送'}: {sms.phoneNumber}
                        </p>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            sms.status === 'sent' || sms.status === 'received'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : sms.status === 'failed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {sms.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sms.content}</p>
                      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        {new Date(sms.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                第 {page} 页 / 共 {data?.pagination?.totalPages || 1} 页
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.pagination?.totalPages || 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
