# ShotGrid Light

面向内部影视工作室的局域网项目协作与版本审核系统。

当前仓库包含：

- React 前端演示界面；
- Express 局域网应用服务器；
- PostgreSQL 数据结构和迁移；
- 本地账号、密码哈希、服务端会话和登录审计基础；
- 镜头、资产、任务、版本、审核、文件与部门沟通的数据模型。

账号登录、会话恢复、员工账号管理、项目创建/选择和项目成员管理已经使用服务端数据库。镜头、场次、资产、任务、版本、审核意见、审核单、项目文件和沟通频道/消息均通过 `src/api/*.ts` 适配器读写服务端数据库；`localStorage` 仅保留当前选中项目等 UI 偏好，不再保存生产业务数据。

## 环境要求

- Node.js 20 或更高版本；
- PostgreSQL 15 或更高版本；
- npm；
- 可选：Docker Desktop 或 Docker Engine，用于启动仓库自带的 PostgreSQL Compose 服务。

## 本地开发

1. 安装依赖：

   ```powershell
   npm install
   ```

2. 复制环境配置：

   ```powershell
   Copy-Item .env.example .env
   ```

3. 编辑 `.env`：

   - 将 `POSTGRES_PASSWORD` 和 `DATABASE_URL` 中的密码改成同一个强密码；
   - 将 `BOOTSTRAP_ADMIN_PASSWORD` 改成首位管理员的强密码；
   - 不要提交 `.env`。

4. 启动 PostgreSQL。

   如果已安装 Docker：

   ```powershell
   docker compose up -d postgres
   ```

   也可以使用原生 PostgreSQL，并创建名为 `shotgrid` 的数据库和用户。

5. 启动应用：

   ```powershell
   npm run dev
   ```

首次启动会自动执行数据库迁移，并在空数据库中创建 `.env` 配置的管理员。

打开：

- 应用：`http://127.0.0.1:3000`
- 存活检查：`http://127.0.0.1:3000/api/health/live`
- 数据库就绪检查：`http://127.0.0.1:3000/api/health/ready`

同一局域网内的员工可以通过服务器 IP 访问，例如 `http://192.168.1.20:3000`。需要在服务器防火墙中只对可信局域网开放该端口。

## 登录 API

登录：

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@studio.local",
  "password": "your-password"
}
```

会话使用 `HttpOnly`、`SameSite=Lax` Cookie。浏览器不会接触会话哈希或密码哈希。

其他接口：

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/system/info`
- `GET /api/admin/users`（管理员）
- `POST /api/admin/users`（管理员）
- `GET /api/users`（内部员工目录）
- `GET /api/projects`
- `POST /api/projects`（管理员、项目总监）
- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members`（项目管理员、项目总监）
- `DELETE /api/projects/:projectId/members/:userId`（项目管理员、项目总监）

管理员登录后可以从右上角账号菜单打开“员工账号管理”，无需手工调用接口创建员工。
首次使用会引导管理员或总监创建项目；存在多个项目时，可以在顶部项目栏切换。

## 命令

```powershell
npm run dev          # Express + Vite 开发服务器
npm run db:migrate   # 手动执行数据库迁移
npm run lint         # TypeScript 检查
npm test             # 服务端安全单元测试
npm run build        # 构建前端和服务端
npm start            # 启动生产构建
```

## 上线前检查清单

- [ ] 生产环境使用 Node.js 20+、PostgreSQL 15+ 和锁定依赖安装；
- [ ] `.env` 已使用生产配置，密钥和数据库连接串未提交到 Git；
- [ ] 发布前手动执行 `npm run db:migrate`，生产环境保持 `AUTO_MIGRATE=false`；
- [ ] 反向代理已启用 HTTPS，且 `SESSION_COOKIE_SECURE=true`；
- [ ] PostgreSQL 端口未暴露给员工终端或互联网；
- [ ] `STORAGE_ROOT` 指向受控磁盘、NAS 或对象存储网关目录，应用服务账号可读写；
- [ ] 上传大小、代理超时、磁盘容量和可选病毒扫描命令已按项目文件规模配置；
- [ ] 每日数据库备份、保留周期、负责人和恢复演练流程已确认；
- [ ] `/api/health/live` 和 `/api/health/ready` 在切流前检查通过；
- [ ] Gemini 等外部服务密钥只保存在服务端。

生产部署、备份恢复、迁移策略和故障排查参见 [docs/production-deployment.md](docs/production-deployment.md)。详细架构和迁移顺序参见 [docs/lan-architecture.md](docs/lan-architecture.md)。
