# 调制解调器状态（Status）

## 概述

提供调制解调器当前实时状态的快照，包括连接状态、SIM 卡状态、网络注册状态、信号质量和设备信息。后端通过 StatusModule 每 10 秒轮询一次调制解调器，并通过 WebSocket 推送更新事件。

## 数据模型：ModemStatus

| 字段 | 类型 | 说明 |
|------|------|------|
| state | enum | 调制解调器连接状态，见下方枚举 |
| simStatus | enum | SIM 卡状态，见下方枚举 |
| networkStatus | enum | 网络注册状态，见下方枚举 |
| operator | string? | 运营商名称（如 `中国移动`），来自 MCC+MNC 查找表 |
| operatorCode | string? | MCC+MNC 代码（5位数字，如 `46000`） |
| signalQuality | SignalQuality | 信号质量详情，见下方 |
| info | ModemInfo? | 设备固定信息，见下方 |
| lastUpdated | datetime | 最后一次成功轮询的时间 |

### 枚举：state

| 值 | 说明 |
|----|------|
| `disconnected` | 未连接到调制解调器 |
| `connecting` | 正在连接中 |
| `connected` | 已连接且正常工作 |
| `error` | 连接错误或设备异常 |

### 枚举：simStatus

| 值 | 说明 |
|----|------|
| `unknown` | 状态未知 |
| `ready` | SIM 卡就绪 |
| `pin_required` | 需要输入 PIN 码 |
| `puk_required` | 需要输入 PUK 码 |
| `not_inserted` | 未插入 SIM 卡 |
| `error` | SIM 卡错误 |

### 枚举：networkStatus

| 值 | 说明 |
|----|------|
| `unknown` | 状态未知 |
| `not_registered` | 未注册网络 |
| `registered_home` | 已注册，归属网络 |
| `searching` | 正在搜索网络 |
| `denied` | 注册被拒绝 |
| `registered_roaming` | 已注册，漫游网络 |

### SignalQuality

| 字段 | 类型 | 说明 |
|------|------|------|
| rssi | integer | 接收信号强度（dBm），典型范围 -113 ~ -51，-113 表示最弱，99 表示未知 |
| ber | integer | 误码率（0-7，或 99 表示未知） |
| rsrp | integer? | LTE 参考信号接收功率（dBm），典型范围 -140 ~ -44 |
| rsrq | integer? | LTE 参考信号接收质量（dB），典型范围 -20 ~ -3 |
| sinr | number? | LTE 信噪比（dB） |

### ModemInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| manufacturer | string | 制造商，如 `SIMCOM` |
| model | string | 型号，如 `A7670C` |
| revision | string | 固件版本字符串 |
| imei | string | 设备唯一标识（15 位数字） |
| imsi | string? | SIM 卡标识（15 位数字） |
| iccid | string? | SIM 卡 ID（19-20 位数字） |

## API 端点

### GET /status

获取当前调制解调器状态快照。需要 Bearer Token。

**响应示例**
```json
{
  "state": "connected",
  "simStatus": "ready",
  "networkStatus": "registered_home",
  "operator": "中国移动",
  "operatorCode": "46000",
  "signalQuality": {
    "rssi": -75,
    "ber": 0,
    "rsrp": -95,
    "rsrq": -12,
    "sinr": 15.5
  },
  "info": {
    "manufacturer": "SIMCOM",
    "model": "A7670C",
    "revision": "A7670C_B07V03_230720",
    "imei": "867000000000001",
    "imsi": "460001234567890",
    "iccid": "89860000000000000001"
  },
  "lastUpdated": "2026-10-22T10:00:00.000Z"
}
```

## 健康检查

### GET /health

无需认证。检查数据库连接是否正常，用于 Docker healthcheck 和负载均衡探针。

**响应（正常）**
```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } }
}
```

**响应（异常）**，HTTP 503：
```json
{
  "status": "error",
  "error": { "database": { "status": "down", "message": "..." } }
}
```

## 相关事件

状态更新通过 WebSocket 实时推送，详见 [realtime-events.md](./realtime-events.md) 中的 `modem.status_update` 事件。
