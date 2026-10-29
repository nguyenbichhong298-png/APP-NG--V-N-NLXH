import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AIGrading,
  Assignment,
  Essay,
  EssayVersion,
  PeerReview,
  Profile,
  PromptRow,
  Round,
  RubricConfirmation,
  TeacherGrading,
  WriterResponse,
} from "../types";

export interface Tables {
  profiles: Profile;
  prompts: PromptRow;
  rounds: Round;
  essays: Essay;
  essay_versions: EssayVersion;
  assignments: Assignment;
  peer_reviews: PeerReview;
  writer_responses: WriterResponse;
  ai_gradings: AIGrading;
  teacher_gradings: TeacherGrading;
  rubric_confirmations: RubricConfirmation;
}
export type TableName = keyof Tables;

/** Bộ lọc bằng nhau; giá trị mảng nghĩa là "thuộc tập". */
export type Filter<T> = { [K in keyof T]?: T[K] | T[K][] };

export interface Db {
  list<N extends TableName>(table: N, filter?: Filter<Tables[N]>): Promise<Tables[N][]>;
  get<N extends TableName>(table: N, id: string): Promise<Tables[N] | null>;
  insert<N extends TableName>(table: N, row: Omit<Tables[N], "id"> & { id?: string }): Promise<Tables[N]>;
  insertMany<N extends TableName>(table: N, rows: (Omit<Tables[N], "id"> & { id?: string })[]): Promise<Tables[N][]>;
  update<N extends TableName>(table: N, id: string, patch: Partial<Tables[N]>): Promise<Tables[N]>;
  remove<N extends TableName>(table: N, id: string): Promise<void>;
}

export const isSupabaseConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Chế độ thử nghiệm cục bộ: lưu vào tệp JSON, chỉ dùng khi chưa cấu hình Supabase và không chạy production. */
export const isDemoMode = () =>
  !isSupabaseConfigured() && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1");

// ---------------------------------------------------------------- Supabase

// Bảng được truy cập theo tên động nên dùng truy vấn không định kiểu; kiểu trả về do `Tables` bảo đảm.
type AnyQuery = {
  eq: (c: string, v: unknown) => AnyQuery;
  in: (c: string, v: unknown[]) => AnyQuery;
  is: (c: string, v: null) => AnyQuery;
  select: (s: string) => AnyQuery;
  single: () => AnyQuery;
  maybeSingle: () => AnyQuery;
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>["then"];
};
type AnyTable = {
  select: (s: string) => AnyQuery;
  insert: (rows: unknown) => AnyQuery;
  update: (patch: unknown) => AnyQuery;
  delete: () => AnyQuery;
};

class SupabaseDb implements Db {
  constructor(private supabase: SupabaseClient) {}

  private client = {
    from: (table: string) => (this.supabase.from as unknown as (t: string) => AnyTable)(table),
  };

  private applyFilter(q: AnyQuery, filter: Record<string, unknown> = {}): AnyQuery {
    for (const [k, v] of Object.entries(filter)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) q = q.in(k, v);
      else if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }
    return q;
  }

  async list<N extends TableName>(table: N, filter?: Filter<Tables[N]>) {
    const { data, error } = await this.applyFilter(this.client.from(table).select("*"), filter as Record<string, unknown>);
    if (error) throw new Error(`Lỗi đọc ${table}: ${error.message}`);
    return (data ?? []) as Tables[N][];
  }
  async get<N extends TableName>(table: N, id: string) {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Lỗi đọc ${table}: ${error.message}`);
    return (data ?? null) as Tables[N] | null;
  }
  async insert<N extends TableName>(table: N, row: Omit<Tables[N], "id"> & { id?: string }) {
    const { data, error } = await this.client.from(table).insert(row).select("*").single();
    if (error) throw new Error(`Lỗi ghi ${table}: ${error.message}`);
    return data as Tables[N];
  }
  async insertMany<N extends TableName>(table: N, rows: (Omit<Tables[N], "id"> & { id?: string })[]) {
    if (rows.length === 0) return [];
    const { data, error } = await this.client.from(table).insert(rows).select("*");
    if (error) throw new Error(`Lỗi ghi ${table}: ${error.message}`);
    return data as Tables[N][];
  }
  async update<N extends TableName>(table: N, id: string, patch: Partial<Tables[N]>) {
    const { data, error } = await this.client.from(table).update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(`Lỗi cập nhật ${table}: ${error.message}`);
    return data as Tables[N];
  }
  async remove<N extends TableName>(table: N, id: string) {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw new Error(`Lỗi xóa ${table}: ${error.message}`);
  }
}

// ---------------------------------------------------------------- Tệp JSON (thử nghiệm)

type Store = { [N in TableName]: Tables[N][] };
const EMPTY: Store = {
  profiles: [],
  prompts: [],
  rounds: [],
  essays: [],
  essay_versions: [],
  assignments: [],
  peer_reviews: [],
  writer_responses: [],
  ai_gradings: [],
  teacher_gradings: [],
  rubric_confirmations: [],
};

class FileDb implements Db {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  private async read(): Promise<Store> {
    try {
      return { ...EMPTY, ...JSON.parse(await fs.readFile(this.file, "utf8")) } as Store;
    } catch {
      return structuredClone(EMPTY);
    }
  }
  private async write(store: Store) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 1), "utf8");
    await fs.rename(tmp, this.file);
  }
  /** Tuần tự hóa thao tác ghi trong một tiến trình. */
  private mutate<T>(fn: (s: Store) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const s = await this.read();
      const out = fn(s);
      await this.write(s);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
  private match(row: Record<string, unknown>, filter: Record<string, unknown> = {}) {
    return Object.entries(filter).every(([k, v]) =>
      v === undefined ? true : Array.isArray(v) ? v.includes(row[k]) : (row[k] ?? null) === v,
    );
  }

  async list<N extends TableName>(table: N, filter?: Filter<Tables[N]>) {
    await this.queue;
    const s = await this.read();
    return (s[table] as Tables[N][]).filter((r) => this.match(r as unknown as Record<string, unknown>, filter as Record<string, unknown>));
  }
  async get<N extends TableName>(table: N, id: string) {
    await this.queue;
    const s = await this.read();
    return ((s[table] as Tables[N][]).find((r) => (r as { id: string }).id === id) ?? null) as Tables[N] | null;
  }
  async insert<N extends TableName>(table: N, row: Omit<Tables[N], "id"> & { id?: string }) {
    const [r] = await this.insertMany(table, [row]);
    return r;
  }
  insertMany<N extends TableName>(table: N, rows: (Omit<Tables[N], "id"> & { id?: string })[]) {
    return this.mutate((s) => {
      const created = rows.map((r) => ({ ...r, id: r.id ?? crypto.randomUUID() }) as Tables[N]);
      (s[table] as Tables[N][]).push(...created);
      return created;
    });
  }
  update<N extends TableName>(table: N, id: string, patch: Partial<Tables[N]>) {
    return this.mutate((s) => {
      const rows = s[table] as Tables[N][];
      const i = rows.findIndex((r) => (r as { id: string }).id === id);
      if (i < 0) throw new Error(`Không tìm thấy bản ghi ${table}/${id}`);
      rows[i] = { ...rows[i], ...patch, id };
      return rows[i];
    });
  }
  remove<N extends TableName>(table: N, id: string) {
    return this.mutate((s) => {
      (s as Record<string, unknown[]>)[table] = (s[table] as { id: string }[]).filter((r) => r.id !== id);
    });
  }
}

let instance: Db | null = null;

export function getDb(): Db {
  if (instance) return instance;
  if (isSupabaseConfigured()) {
    instance = new SupabaseDb(
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  } else if (isDemoMode()) {
    instance = new FileDb(path.join(process.cwd(), ".data", "db.json"));
  } else {
    throw new Error("Chưa cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).");
  }
  return instance;
}

export const now = () => new Date().toISOString();
