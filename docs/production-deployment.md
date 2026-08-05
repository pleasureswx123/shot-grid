# 生产部署指南

本文档用于 ShotGrid Light 在工作室内网或受控专网中的生产部署、备份恢复和上线前运维检查。生产环境应由指定运维负责人执行发布、备份、恢复演练和事故处理。

## 1. 基础环境

### Node.js 与构建

- 使用 Node.js 20 或更高版本，与 `README.md` 的环境要求保持一致。
- 使用 `npm ci` 安装锁定依赖，避免生产服务器安装到未验证版本。
- 发布前执行：

  ```bash
  npm ci
  npm run lint
  npm test
  npm run build
  ```

- 生产启动命令为：

  ```bash
  npm start
  ```

### PostgreSQL

- 使用 PostgreSQL 15 或更高版本。
- 数据库应部署在应用服务器本机、同机房数据库服务器或受控内网数据库服务中。
- PostgreSQL 端口只允许应用服务器访问，不要暴露给员工终端或互联网。
- 推荐为生产单独创建数据库和用户：

  ```sql
  CREATE USER shotgrid_prod WITH PASSWORD 'replace-with-strong-password';
  CREATE DATABASE shotgrid_prod OWNER shotgrid_prod;
  ```

- 连接串写入服务端 `.env` 的 `DATABASE_URL`，不要提交到 Git。

### 反向代理

建议使用 Nginx、Caddy 或公司统一网关作为反向代理，统一处理 HTTPS、访问日志、请求体大小和内网域名。反向代理只转发到本机应用端口，例如 `127.0.0.1:3000`。

Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name shotgrid.studio.local;

    ssl_certificate /etc/ssl/shotgrid/fullchain.pem;
    ssl_certificate_key /etc/ssl/shotgrid/privkey.pem;

    client_max_body_size 2048m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### HTTPS 与 Cookie

- 生产环境必须启用 HTTPS，并设置 `SESSION_COOKIE_SECURE=true`。
- 应用在反向代理后运行时保留默认 `TRUST_PROXY=loopback, linklocal, uniquelocal`，或按网关拓扑改成明确可信代理。
- 只有在临时隔离测试环境中，才可以设置 `ALLOW_INSECURE_PRODUCTION_COOKIES=true`；正式生产禁止使用该例外。

## 2. 生产环境变量

生产 `.env` 至少应包含：

```bash
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://shotgrid_prod:replace-with-strong-password@127.0.0.1:5432/shotgrid_prod
DATABASE_SSL=false
DATABASE_POOL_MAX=20
AUTO_MIGRATE=false
BOOTSTRAP_ADMIN_NAME=系统管理员
BOOTSTRAP_ADMIN_EMAIL=admin@studio.local
BOOTSTRAP_ADMIN_PASSWORD=replace-before-first-start
SESSION_TTL_HOURS=168
SESSION_COOKIE_SECURE=true
TRUST_PROXY=loopback, linklocal, uniquelocal
STORAGE_ROOT=/srv/shotgrid/storage
MAX_UPLOAD_MB=2048
VIRUS_SCAN_COMMAND=
GEMINI_API_KEY=
```

说明：

- `HOST`：反向代理部署时建议绑定 `127.0.0.1`，避免绕过代理直接访问。
- `DATABASE_URL`：使用生产数据库账号和强密码。
- `BOOTSTRAP_ADMIN_PASSWORD`：仅首次空库初始化使用，首位管理员创建后应从环境文件中移除或替换为无效值。
- `STORAGE_ROOT`：必须指向应用服务账号可读写的本地磁盘、挂载 NAS 或对象存储网关目录。
- `MAX_UPLOAD_MB`：需与反向代理的上传大小限制保持一致。
- `GEMINI_API_KEY`：外部服务密钥只能保存在服务端。

## 3. 存储目录权限

假设 systemd 服务用户为 `shotgrid`，生产存储目录为 `/srv/shotgrid/storage`：

```bash
sudo mkdir -p /srv/shotgrid/storage
sudo chown -R shotgrid:shotgrid /srv/shotgrid/storage
sudo chmod 0750 /srv/shotgrid/storage
sudo -u shotgrid test -w /srv/shotgrid/storage
```

如果目录来自 NAS 挂载：

- 确认开机自动挂载早于应用服务启动；
- 确认 UID/GID 映射后仍允许 `shotgrid` 用户读写；
- 禁止员工绕过应用直接修改受控文件；
- 将 NAS 快照纳入备份保留策略。

## 4. 数据库迁移策略

生产环境不建议在应用启动时自动迁移，`AUTO_MIGRATE` 应设置为 `false`。原因是数据库结构变更应在发布窗口内完成，并允许发布人员在应用切流前确认迁移输出。

推荐发布流程：

1. 通知使用者进入发布维护窗口。
2. 确认最近一次数据库备份成功。
3. 拉取并安装新版本代码与依赖。
4. 执行迁移：

   ```bash
   npm run db:migrate
   ```

5. 执行构建和健康检查。
6. 重启应用服务。
7. 访问 `/api/health/live` 和 `/api/health/ready` 确认服务与数据库就绪。

仅开发环境或一次性测试环境允许 `AUTO_MIGRATE=true`。如生产必须临时启用自动迁移，需由发布负责人在变更单中记录原因、影响范围、回滚方案和执行时间。

## 5. systemd 部署方式

创建系统用户和目录：

```bash
sudo useradd --system --create-home --home-dir /opt/shotgrid --shell /usr/sbin/nologin shotgrid
sudo mkdir -p /opt/shotgrid/app /srv/shotgrid/storage
sudo chown -R shotgrid:shotgrid /opt/shotgrid /srv/shotgrid/storage
```

示例服务文件 `/etc/systemd/system/shotgrid.service`：

```ini
[Unit]
Description=ShotGrid Light
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=shotgrid
Group=shotgrid
WorkingDirectory=/opt/shotgrid/app
EnvironmentFile=/opt/shotgrid/app/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

启用与更新：

```bash
sudo systemctl daemon-reload
sudo systemctl enable shotgrid
sudo systemctl start shotgrid
sudo systemctl status shotgrid
```

查看日志：

```bash
journalctl -u shotgrid -f
```

## 6. 容器部署方式

容器部署应将配置、数据库和媒体文件放在容器外部。最低要求：

- 应用容器使用只读镜像和外部 `.env`；
- PostgreSQL 使用持久化卷；
- `STORAGE_ROOT` 挂载为持久化卷或 NAS 路径；
- 反向代理负责 HTTPS；
- 迁移仍在发布前通过一次性命令执行。

示例 Compose 片段：

```yaml
services:
  app:
    image: shotgrid-light:latest
    env_file: .env.production
    command: npm start
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - /srv/shotgrid/storage:/srv/shotgrid/storage
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: shotgrid_prod
      POSTGRES_USER: shotgrid_prod
      POSTGRES_PASSWORD: replace-with-strong-password
    volumes:
      - shotgrid-postgres:/var/lib/postgresql/data

volumes:
  shotgrid-postgres:
```

发布前迁移示例：

```bash
docker compose run --rm app npm run db:migrate
```

## 7. 数据库备份与恢复

### 负责人和保留周期

- 负责人：生产运维负责人；备用负责人：技术负责人或制片技术管理员。
- 每日自动备份：至少保留 30 天。
- 每周完整备份：至少保留 12 周。
- 每月归档备份：至少保留 12 个月，按公司数据政策决定是否加密离线保存。
- 每季度至少进行一次恢复演练，并记录演练日期、备份文件、恢复耗时、校验结果和发现的问题。

### 每日备份命令

示例脚本 `/opt/shotgrid/bin/backup-db.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/srv/shotgrid/backups/postgres
DATE=$(date +%F_%H%M%S)
mkdir -p "$BACKUP_DIR"

pg_dump \
  --format=custom \
  --file="$BACKUP_DIR/shotgrid_${DATE}.dump" \
  "$DATABASE_URL"

find "$BACKUP_DIR" -type f -name 'shotgrid_*.dump' -mtime +30 -delete
```

Cron 示例：

```cron
30 2 * * * shotgrid /opt/shotgrid/bin/backup-db.sh >> /var/log/shotgrid-db-backup.log 2>&1
```

备份完成后应同步到 NAS、备份服务器或对象存储，并定期校验备份文件可读。

### 恢复演练步骤

1. 在隔离测试数据库中创建空库，禁止直接覆盖生产库。
2. 选择最近备份文件，例如 `shotgrid_2026-08-05_023000.dump`。
3. 恢复到演练库：

   ```bash
   createdb shotgrid_restore_test
   pg_restore \
     --dbname=shotgrid_restore_test \
     --clean \
     --if-exists \
     /srv/shotgrid/backups/postgres/shotgrid_2026-08-05_023000.dump
   ```

4. 使用只读或临时应用实例连接演练库。
5. 检查管理员登录、项目列表、成员、任务、版本元数据和文件路径是否符合预期。
6. 记录恢复耗时、校验结果、缺失数据和改进项。
7. 删除演练库或保留到演练报告完成后再删除。

### 生产恢复步骤

1. 宣布故障和维护窗口，停止应用写入。
2. 备份当前异常库，避免覆盖现场。
3. 选择已验证的备份文件。
4. 在生产库执行恢复，或创建新库恢复后切换 `DATABASE_URL`。
5. 执行 `npm run db:migrate`，确保恢复库结构与当前应用版本一致。
6. 启动应用并检查 `/api/health/ready`。
7. 由负责人确认数据后恢复使用者访问。

## 8. 故障排查

### 数据库不可用

现象：`/api/health/ready` 失败、登录失败、服务日志出现连接超时或认证失败。

处理：

- 检查 PostgreSQL 是否运行：`systemctl status postgresql` 或 `docker compose ps postgres`。
- 检查 `DATABASE_URL`、密码、数据库名和网络连通性。
- 检查数据库连接数是否耗尽，必要时降低 `DATABASE_POOL_MAX` 或排查慢查询。
- 确认防火墙只允许应用服务器访问数据库端口。

### 存储目录不可写

现象：上传接口返回权限错误，日志出现 `EACCES`、`EPERM` 或目录创建失败。

处理：

- 执行 `sudo -u shotgrid test -w /srv/shotgrid/storage`。
- 检查 `STORAGE_ROOT` 是否指向正确挂载点。
- 检查目录属主、权限、NAS 挂载状态和磁盘空间。
- 修改权限后重试上传，不要把目录改成全员可写。

### 上传失败

现象：大文件上传中断、反向代理返回 413、应用返回扫描失败或超出大小限制。

处理：

- 确认 `MAX_UPLOAD_MB` 与 Nginx `client_max_body_size` 一致。
- 检查磁盘空间和临时目录空间。
- 如果启用 `VIRUS_SCAN_COMMAND`，检查杀毒命令是否存在、超时或误报。
- 检查浏览器到反向代理、反向代理到应用的超时设置。

### Cookie 不生效

现象：登录成功后刷新即退出，或浏览器没有携带 `shotgrid_session`。

处理：

- 生产 HTTPS 环境确认 `SESSION_COOKIE_SECURE=true`。
- 确认用户访问的是 HTTPS 域名，而不是 IP 或 HTTP 地址。
- 检查反向代理是否设置 `X-Forwarded-Proto`，并确认 `TRUST_PROXY` 信任该代理。
- 检查浏览器开发者工具中的 Cookie 域名、Secure、SameSite 和过期时间。

### 权限错误

现象：接口返回 401、403，或按钮可见但操作失败。

处理：

- 401 通常表示未登录或会话过期，重新登录并检查服务器时间。
- 403 通常表示角色或项目成员权限不足，检查用户角色和项目成员配置。
- 确认账号未被停用，且正在操作正确项目。
- 以管理员身份查看审计日志和服务日志，确认失败接口和用户身份。

## 9. 上线前检查清单

- [ ] Node.js、PostgreSQL 和 npm 版本符合要求。
- [ ] `.env` 已使用生产值，且未提交到 Git。
- [ ] `AUTO_MIGRATE=false`，迁移将在发布前手动执行。
- [ ] `SESSION_COOKIE_SECURE=true`，外部访问已使用 HTTPS。
- [ ] PostgreSQL 端口未暴露给员工终端或互联网。
- [ ] `STORAGE_ROOT` 存储目录存在、容量充足且应用账号可读写。
- [ ] 反向代理上传大小限制与 `MAX_UPLOAD_MB` 一致。
- [ ] 已执行 `npm run db:migrate`、`npm run build` 和健康检查。
- [ ] 每日数据库备份任务已启用，最近一次备份成功。
- [ ] 最近一次恢复演练记录在有效期内。
- [ ] 负责人和备用负责人已确认发布窗口、回滚方式和联系方式。
