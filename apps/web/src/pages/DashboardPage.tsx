import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export default function DashboardPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => apiClient.getStatus(),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        系统状态
      </h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`h-3 w-3 rounded-full ${status?.state === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    调制解调器状态
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {status?.state === 'connected' ? '已连接' : '未连接'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    SIM 卡状态
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {status?.simStatus === 'READY' ? '正常' : status?.simStatus || '未知'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    网络状态
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {status?.networkStatus === 'REGISTERED_HOME' ? '已注册' : status?.networkStatus || '未知'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    运营商
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {status?.operator || '未知'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    信号强度 (RSSI)
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {status?.signalQuality?.rssi ?? 'N/A'} dBm
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    IMEI
                  </dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {status?.info?.imei || 'N/A'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          设备信息
        </h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">制造商</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{status?.info?.manufacturer || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">型号</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{status?.info?.model || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">固件版本</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{status?.info?.revision || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ICCID</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{status?.info?.iccid || 'N/A'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
