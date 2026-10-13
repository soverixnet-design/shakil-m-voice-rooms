-- EarnBD backend foundation. Existing Firebase UIDs remain text identifiers.
-- Only the trusted backend has access until scoped APIs and migration are tested.
create schema if not exists earnbd;
revoke all on schema earnbd from public, anon, authenticated;
create table if not exists earnbd.users (
 uid text primary key,
 public_id text not null unique,
 profile jsonb not null default '{}'::jsonb,
 status text not null default 'active' check(status in ('active','banned','archived')),
 created_at timestamptz not null default now()
);
create table if not exists earnbd.wallets (
 uid text primary key references earnbd.users(uid),
 coins bigint not null default 0 check(coins between 0 and 9007199254740991),
 diamonds bigint not null default 0 check(diamonds between 0 and 9007199254740991),
 version bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists earnbd.rooms (
 id text primary key,
 owner_uid text not null unique references earnbd.users(uid),
 settings jsonb not null default '{}'::jsonb,
 locked boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists earnbd.room_members (
 room_id text not null references earnbd.rooms(id),
 uid text not null references earnbd.users(uid),
 seat integer check(seat between 0 and 11),
 role text not null default 'member' check(role in ('member','admin')),
 last_seen timestamptz not null default now(),
 primary key(room_id,uid),
 unique(room_id,seat)
);
create index if not exists room_members_uid_idx on earnbd.room_members(uid);
create table if not exists earnbd.game_rounds (
 game text not null,
 round_id text not null,
 starts_at timestamptz not null,
 closes_at timestamptz not null,
 reveals_at timestamptz not null,
 state text not null default 'open' check(state in ('open','closed','settled')),
 result jsonb,
 primary key(game,round_id),
 check(starts_at < closes_at and closes_at <= reveals_at)
);
create index if not exists pending_rounds_idx on earnbd.game_rounds(reveals_at) where state <> 'settled';
create table if not exists earnbd.game_secrets (
 game text not null,
 round_id text not null,
 seed text not null,
 primary key(game,round_id),
 foreign key(game,round_id) references earnbd.game_rounds(game,round_id)
);
create table if not exists earnbd.game_bets (
 uid text not null references earnbd.users(uid),
 request_id text not null,
 game text not null,
 round_id text not null,
 choice integer not null check(choice >= 0),
 stake bigint not null check(stake > 0 and stake <= 1000000000),
 payout bigint check(payout >= 0),
 created_at timestamptz not null default now(),
 primary key(uid,request_id),
 foreign key(game,round_id) references earnbd.game_rounds(game,round_id)
);
create index if not exists game_bets_round_idx on earnbd.game_bets(game,round_id);
create table if not exists earnbd.wallet_ledger (
 uid text not null references earnbd.users(uid),
 request_id text not null,
 kind text not null,
 coin_delta bigint not null,
 diamond_delta bigint not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 primary key(uid,request_id)
);
create index if not exists wallet_ledger_history_idx on earnbd.wallet_ledger(uid,created_at desc);
do $$ declare t text; begin
 foreach t in array array['users','wallets','rooms','room_members','game_rounds','game_secrets','game_bets','wallet_ledger'] loop
 execute format('alter table earnbd.%I enable row level security',t);
 execute format('revoke all on table earnbd.%I from public, anon, authenticated',t);
 execute format('grant select, insert, update, delete on table earnbd.%I to service_role',t);
 end loop;
end $$;
grant usage on schema earnbd to service_role;

-- Firebase-compatible social data: backend access only.
create table if not exists earnbd.social_documents (
 path text primary key, parent text not null, document_id text not null,
 fields jsonb not null, version bigint not null default 1,
 updated_at timestamptz not null default now()
);
create index if not exists social_documents_parent_idx on earnbd.social_documents(parent,document_id);
alter table earnbd.social_documents enable row level security;
revoke all on table earnbd.social_documents from public,anon,authenticated;
grant select,insert,update,delete on table earnbd.social_documents to service_role;
