// The part of the optional `emdash` peer dependency that this package reads.
declare module "emdash" {
  export function getEmDashCollection(
    type: string,
    filter?: {
      status?: "draft" | "published" | "archived";
      limit?: number;
      cursor?: string;
      locale?: string;
    }
  ): Promise<{
    entries: { id: string; data: Record<string, unknown> }[];
    error?: Error;
    nextCursor?: string;
  }>;
  export function getRequestContext(): { locale?: string } | undefined;
}
