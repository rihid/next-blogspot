import { ImageResponse } from "next/og";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 200;

function clamp(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function GET(request: Request): Response {
  const { searchParams } = new URL(request.url);
  const title = clamp(searchParams.get("title")?.trim() || "next-blogspot", MAX_TITLE_LENGTH);
  const description = clamp(
    searchParams.get("description")?.trim() ?? "",
    MAX_DESCRIPTION_LENGTH,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: 64,
          backgroundColor: "#ffffff",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
          {title}
        </div>
        {description ? (
          <div style={{ display: "flex", fontSize: 32, color: "#555555", lineHeight: 1.35 }}>
            {description}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 24, color: "#888888" }}>next-blogspot</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
