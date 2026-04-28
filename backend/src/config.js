import dotenv from "dotenv";

export function loadConfig() {
  dotenv.config();

  const port = Number(process.env.PORT ?? 5000);
  if (!Number.isFinite(port)) throw new Error("PORT must be a number");

  const jwtIssuer = process.env.JWT_ISSUER ?? "http://localhost:5000";
  const jwtAudience = process.env.JWT_AUDIENCE ?? "http://localhost:5000";
  const jwtKey = process.env.JWT_KEY ?? "";
  if (!jwtKey) throw new Error("JWT_KEY is required");

  const sqliteFile = process.env.SQLITE_FILE ?? "data/app.sqlite";

  return {
    port,
    jwt: {
      issuer: jwtIssuer,
      audience: jwtAudience,
      key: jwtKey,
    },
    sqlite: {
      file: sqliteFile,
    },
  };
}
