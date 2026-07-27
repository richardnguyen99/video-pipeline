interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /* Enable mock network delay via `VITE_ENABLE_DELAY=true` in .env file or via `VITE_ENABLE_DELAY=true` in the command line. */
  readonly VITE_ENABLE_DELAY: boolean;

  readonly VITE_DELAY: number | "random";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
