-- Baochat database schema (PostgreSQL 13+). Idempotent: có thể chạy lại nhiều lần.

CREATE TABLE IF NOT EXISTS users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq                bigserial UNIQUE,                       -- số thứ tự -> mã công khai BC-000001
  email              text NOT NULL UNIQUE,                   -- luôn lưu chữ thường
  email_verified     boolean NOT NULL DEFAULT false,
  password_hash      text,
  google_sub         text UNIQUE,
  display_name       text NOT NULL,
  avatar_file_id     uuid,
  role               text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  -- token
  token_quota        bigint NOT NULL DEFAULT 0,              -- số token được cấp mỗi chu kỳ (ngẫu nhiên 1000-10000 khi tạo)
  token_balance      bigint NOT NULL DEFAULT 0,
  token_used_cycle   bigint NOT NULL DEFAULT 0,
  token_used_total   bigint NOT NULL DEFAULT 0,
  token_reset_at     timestamptz NOT NULL DEFAULT now(),
  -- tuỳ chọn giao diện / AI
  ui_lang            text NOT NULL DEFAULT 'vi',
  theme              text NOT NULL DEFAULT 'dark',
  accent             text NOT NULL DEFAULT '#F0A528',
  default_mode       text NOT NULL DEFAULT 'casual' CHECK (default_mode IN ('serious','casual','funny','playful')),
  memory_enabled     boolean NOT NULL DEFAULT true,
  use_history        boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users (last_seen_at);

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS email_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('verify','reset')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  mime            text NOT NULL,
  size            integer NOT NULL,
  data            bytea NOT NULL,
  extracted_text  text,
  purpose         text NOT NULL DEFAULT 'attachment' CHECK (purpose IN ('attachment','avatar')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_user_idx ON files (user_id);

CREATE TABLE IF NOT EXISTS ai_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                text NOT NULL,                 -- tên cấu hình
  ai_name             text NOT NULL DEFAULT 'Baochat',
  style               text NOT NULL DEFAULT 'casual' CHECK (style IN ('serious','casual','funny','playful')),
  humor_level         integer NOT NULL DEFAULT 50 CHECK (humor_level BETWEEN 0 AND 100),
  address_style       text NOT NULL DEFAULT '',      -- cách xưng hô, vd: "gọi tôi là anh, bạn xưng em"
  default_lang        text NOT NULL DEFAULT 'auto',
  custom_instructions text NOT NULL DEFAULT '',
  interests           text NOT NULL DEFAULT '',
  is_active           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_profiles_user_idx ON ai_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_profiles_one_active ON ai_profiles (user_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS memories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_user_idx ON memories (user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  mode            text CHECK (mode IN ('serious','casual','funny','playful')),
  model_id        text,
  search_enabled  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','assistant')),
  content          text NOT NULL,
  attachments      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{id,name,mime,size}]
  sources          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{title,url,snippet}]
  model            text,
  tokens_in        integer NOT NULL DEFAULT 0,
  tokens_out       integer NOT NULL DEFAULT 0,
  rating           smallint CHECK (rating IN (-1,1)),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS token_ledger (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta          bigint NOT NULL,           -- âm = tiêu thụ, dương = cấp/reset/điều chỉnh
  balance_after  bigint,
  reason         text NOT NULL,             -- chat | studio | memory | grant | reset | admin_adjust
  model          text,
  ref            text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS token_ledger_user_idx ON token_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS providers (
  id           text PRIMARY KEY,            -- openai, anthropic, gemini...
  label        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('openai','anthropic')),   -- giao thức API
  base_url     text NOT NULL,
  api_key_env  text NOT NULL,               -- TÊN biến môi trường chứa khóa (không lưu khóa)
  enabled      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS models (
  id            text PRIMARY KEY,
  provider_id   text NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model_name    text NOT NULL,
  label         text NOT NULL,
  vision        boolean NOT NULL DEFAULT false,
  max_output    integer NOT NULL DEFAULT 4096,
  multiplier    numeric(6,2) NOT NULL DEFAULT 1,    -- hệ số tính token Baochat
  priority      integer NOT NULL DEFAULT 100,       -- nhỏ hơn = ưu tiên trước (dùng cho fallback)
  enabled       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS system_settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('website','document','presentation','spreadsheet')),
  title       text NOT NULL,
  prompt      text NOT NULL DEFAULT '',
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_items_user_idx ON studio_items (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_logs_time_idx ON activity_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
  id          bigserial PRIMARY KEY,
  source      text NOT NULL,
  message     text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_time_idx ON error_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ===================== Seed cấu hình mặc định =====================
INSERT INTO system_settings (key, value) VALUES
  ('token_reset_interval_hours', '24'),
  ('token_exhausted_wait_hours', '7'),
  ('token_grant_min', '1000000000'),
  ('token_grant_max', '1000000000'),
  ('registration_open', 'true'),
  ('default_model', '"gpt-4o-mini"'),
  ('chat_rate_per_minute', '20'),
  ('max_upload_mb', '10')
ON CONFLICT (key) DO NOTHING;

INSERT INTO providers (id, label, kind, base_url, api_key_env) VALUES
  ('openai',     'OpenAI',     'openai',    'https://api.openai.com/v1', 'OPENAI_API_KEY'),
  ('anthropic',  'Anthropic',  'anthropic', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY'),
  ('gemini',     'Google Gemini', 'openai', 'https://generativelanguage.googleapis.com/v1beta/openai', 'GEMINI_API_KEY'),
  ('deepseek',   'DeepSeek',   'openai',    'https://api.deepseek.com', 'DEEPSEEK_API_KEY'),
  ('openrouter', 'OpenRouter', 'openai',    'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY')
ON CONFLICT (id) DO NOTHING;

-- Tên model mặc định chỉ là điểm khởi đầu: có thể sửa trong Admin Dashboard > Models
-- khi nhà cung cấp đổi tên model.
INSERT INTO models (id, provider_id, model_name, label, vision, max_output, multiplier, priority) VALUES
  ('gpt-4o-mini',     'openai',    'gpt-4o-mini',        'GPT-4o mini',      true,  8192, 1, 10),
  ('claude-sonnet',   'anthropic', 'claude-sonnet-5-5',  'Claude Sonnet',    true,  8192, 1, 20),
  ('gemini-flash',    'gemini',    'gemini-2.0-flash',   'Gemini Flash',     true,  8192, 1, 30),
  ('deepseek-chat',   'deepseek',  'deepseek-chat',      'DeepSeek Chat',    false, 8192, 1, 40)
ON CONFLICT (id) DO NOTHING;

-- Chia sẻ cuộc trò chuyện bằng liên kết (chỉ đọc)
CREATE TABLE IF NOT EXISTS shared_conversations (
  token            text PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shared_conv_unique ON shared_conversations (conversation_id);

-- Ghim cuộc trò chuyện
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
