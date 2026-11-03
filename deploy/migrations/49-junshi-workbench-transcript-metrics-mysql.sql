-- 49 · 内容工作台：转写质量与耗时指标（2026-11-03）。
--
-- 目标：每次 ASR/OCR 提取写一条结果指标，用户确认原文时再写一条人工修改指标。
-- 用于计算成功率、耗时、失败原因、来源分布和人工修改率，不修改转写档案正文表。
--
-- 执行（在服务器上）：
--   mysql --defaults-file=/root/.my.cnf -D aild_admin < deploy/migrations/49-junshi-workbench-transcript-metrics-mysql.sql
-- 回滚：
--   DROP TABLE junshi_workbench_transcript_metrics;
-- 复查：
--   SHOW TABLES LIKE 'junshi_workbench_transcript_metrics';
--   SHOW INDEX FROM junshi_workbench_transcript_metrics;

CREATE TABLE IF NOT EXISTS junshi_workbench_transcript_metrics (
  id                      VARCHAR(64) NOT NULL,
  owner_key               VARCHAR(64) NOT NULL,
  org_id                  VARCHAR(64) NULL,
  account_id              VARCHAR(64) NOT NULL DEFAULT 'default',
  transcript_id           VARCHAR(64) NULL,
  job_id                  VARCHAR(64) NOT NULL DEFAULT '',
  event_type              VARCHAR(24) NOT NULL DEFAULT 'extraction',
  mode                    VARCHAR(16) NOT NULL DEFAULT 'auto',
  status                  VARCHAR(24) NOT NULL DEFAULT '',
  input_source            VARCHAR(16) NOT NULL DEFAULT '',
  result_source           VARCHAR(16) NOT NULL DEFAULT '',
  duration_ms             BIGINT NOT NULL DEFAULT 0,
  asr_status              VARCHAR(24) NOT NULL DEFAULT 'skipped',
  asr_duration_ms         BIGINT NOT NULL DEFAULT 0,
  asr_chars               INT NOT NULL DEFAULT 0,
  asr_segments            INT NOT NULL DEFAULT 0,
  asr_language            VARCHAR(32) NOT NULL DEFAULT '',
  asr_chunks              INT NOT NULL DEFAULT 0,
  asr_error_code          VARCHAR(80) NOT NULL DEFAULT '',
  asr_error               TEXT NULL,
  visual_status           VARCHAR(24) NOT NULL DEFAULT 'skipped',
  visual_duration_ms      BIGINT NOT NULL DEFAULT 0,
  visual_chars            INT NOT NULL DEFAULT 0,
  visual_frames           INT NOT NULL DEFAULT 0,
  visual_sheets           INT NOT NULL DEFAULT 0,
  visual_strategy         VARCHAR(24) NOT NULL DEFAULT '',
  visual_error_code       VARCHAR(80) NOT NULL DEFAULT '',
  visual_error            TEXT NULL,
  result_chars            INT NOT NULL DEFAULT 0,
  result_segments         INT NOT NULL DEFAULT 0,
  video_duration_seconds  DOUBLE NOT NULL DEFAULT 0,
  original_chars          INT NOT NULL DEFAULT 0,
  edited_chars            INT NOT NULL DEFAULT 0,
  edit_ratio              DOUBLE NOT NULL DEFAULT 0,
  edit_capped             TINYINT NOT NULL DEFAULT 0,
  error_code              VARCHAR(80) NOT NULL DEFAULT '',
  error                   TEXT NULL,
  created_at              VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_junshi_wb_metric_owner (owner_key, account_id, created_at),
  KEY idx_junshi_wb_metric_transcript (transcript_id, created_at),
  KEY idx_junshi_wb_metric_event (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
