export function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

/** Local `next dev` only — preview/staging/prod builds use production NODE_ENV. */
export function isNodeDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function requireDatabaseUrlOrThrow(): void {
  if (!trimEnv(process.env.DATABASE_URL)) {
    throw new Error(
      "DATABASE_URL is not set. Admin CRM requires a configured database connection."
    );
  }
}
