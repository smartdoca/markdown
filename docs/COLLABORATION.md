# 协同编辑契约

本包遵循 Doca Collaboration 的分层约定：编辑器只处理 Yjs 文档与临时 presence，传输、认证、持久化 ACK、重连 outbox 和服务端权限属于宿主平台。

## 已在客户端落实

- `protocolVersion`、Markdown `codec/schemaVersion` 与业务版本概念分离。
- 首次编辑器挂载前先等待 IndexedDB 或服务端 Yjs 基线，避免空文档短暂覆盖真实内容。
- 初始化与远端事务具有独立 origin；初始化只在同步基线完成后执行。
- 只读模式关闭编辑能力，也不发布本地用户、光标和选区 presence。
- 连接状态使用 `loading/syncing/ready/disconnected/error`；WebSocket 在线只表示协同链路就绪，不表示数据库已经保存。
- 提供显式 checkpoint 编码边界，Markdown 字符串只是投影，不作为协同真相源。

## 宿主后端必须实现

- 服务端认证与身份覆盖，禁止信任客户端传入的用户身份。
- 每个文档的 `epochId`、单调 `seq/checkpointSeq`、更新 ID 去重和 schema 校验。
- Yjs 更新落库事务提交后再返回 ACK；客户端 outbox 必须保留原始更新 bytes 与 ID，重连后原样重放。
- ACL 收紧后主动关闭现存连接；presence 按会话清理且永不持久化。
- 评论锚点使用永久 Yjs RelativePosition，不能复用 awareness 游标。

当前 `y-websocket` 适配器用于本地演示，没有持久化 ACK，因此公开的 `saveState` 固定为 `unavailable`。产品界面不应据此显示“已保存”。
