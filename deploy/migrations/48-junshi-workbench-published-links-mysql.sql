-- 48 · 内容工作台：发布作品 ↔ 生成方案关联（2026-11-03）。
--
-- 目标：把“实际发布后的作品数据”与“生成该作品的视频任务、发布包、内容方案”连起来，
-- 让数据复盘能比较不同钩子、方案和目标的结果，而不是只看孤立作品。
--
-- 设计：
--   · 不修改 published_works / video_works / plans / video_packages 现有列；
--   · 一个发布作品最多关联一个生成成片，一个生成成片最多关联一个发布作品；
--   · 关联由用户在数据复盘中手动确认，避免仅按标题自动误匹配。
--
-- 执行（在服务器上）：
--   mysql --defaults-file=/root/.my.cnf -D aild_admin < deploy/migrations/48-junshi-workbench-published-links-mysql.sql
-- 回滚：
--   DROP TABLE junshi_workbench_published_links;
-- 复查：
--   SHOW TABLES LIKE 'junshi_workbench_published_links';
--   SHOW INDEX FROM junshi_workbench_published_links;

CREATE TABLE IF NOT EXISTS junshi_workbench_published_links (
  id                 VARCHAR(64) NOT NULL,
  owner_key          VARCHAR(64) NOT NULL,
  org_id             VARCHAR(64) NULL,
  account_id         VARCHAR(64) NOT NULL DEFAULT 'default',
  published_work_id  VARCHAR(64) NOT NULL,
  aweme_id           VARCHAR(32) NOT NULL DEFAULT '',
  work_id            VARCHAR(64) NOT NULL,
  plan_id            VARCHAR(64) NOT NULL DEFAULT '',
  package_id         VARCHAR(64) NOT NULL,
  match_source       VARCHAR(24) NOT NULL DEFAULT 'manual',
  linked_at          VARCHAR(64) NOT NULL,
  created_at         VARCHAR(64) NOT NULL,
  updated_at         VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_junshi_wb_pub_link_work (owner_key, published_work_id),
  UNIQUE KEY uniq_junshi_wb_link_generated (owner_key, work_id),
  KEY idx_junshi_wb_link_owner (owner_key, account_id, linked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
