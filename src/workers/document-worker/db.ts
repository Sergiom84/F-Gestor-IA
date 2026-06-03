import postgres from "postgres";

export type DbConfig = {
  databaseUrl: string;
};

export function createDb(config: DbConfig) {
  return postgres(config.databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
}

export type DbClient = ReturnType<typeof createDb>;
