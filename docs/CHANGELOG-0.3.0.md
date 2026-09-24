# 0.3.0 · Doca SDK 复验交付

## 修复

- 预览切换保持同一个 CodeMirror 和 Yjs binding；隐藏期间接收远端变更与上传结果，返回时不回填旧初值。
- 单一 Yjs 撤销栈，预览、只读、保存状态与用户资料变更不重建视图/模型。批量替换独立成一个撤销批次。
- 宿主管理分支不调用独立连接 hook，消除额外的未连接 Y.Doc/Awareness。
- 公开远端绘制支持折叠光标、可见用户名、focus 方向、跨行选择和逐会话着色；按相对位置重新解析变更。支持 null/空快照清理。
- 区域评论添加完整快照、下划线、激活背景、点击订阅、取消激活、卡片定位以及已解决/删除/丢失区域过滤。
- v2 评论锚点排除两端插入。全部原始字符删除后保持 orphan；撤销恢复正文不自动重绑旧评论，以维持两端与 checkpoint 的一致性。

## Doca 接入变化

正文协议仍是 markdown-ytext / schema 1 / protocol 1，根 markdown 与 exmd:meta 不变。无需迁移存量正文。Doca 可安装新包，在隔离文档复验后解除 preview 临时限制；此包未修改 Doca、slatetsx、Excel、画板或业务数据库。

区域评论通过 renderAnchors / setActiveAnchor / clearAnchors / onAnchorClick 接入。卡片 UI、评论正文及权限由 Doca 实现，源码区支持装饰；MarkdownPreview 内尚不提供区域评论映射。

## 边界

SDK 测试不是平台生产验收。实际 WebSocket 断线、ACK、持久化恢复、ACL、跨部署资源解析需要 Doca 按原有验收用例复验。上传占位/重试、原子 mention、自定义附件卡片未在本版新增。现有全局 CSS 选择器仍需 Doca 原有样式作用域处理。
