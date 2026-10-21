import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function RecordingsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['recordings', page],
    queryFn: () => apiClient.listRecordings({ page, limit: 20 }),
  });

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">录音管理</h1>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">录音列表</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-center">加载中...</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.data?.map((recording: any) => (
                <li key={recording.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        录音文件: {recording.filePath}
                      </p>
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <p>格式: {recording.format.toUpperCase()}</p>
                        {recording.duration && <p>时长: {recording.duration} 秒</p>}
                        {recording.transcription && (
                          <p className="mt-2">转录: {recording.transcription}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          {new Date(recording.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
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
