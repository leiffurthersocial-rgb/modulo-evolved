import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07090c",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 64 64">
        <path
          d="M20 14c0 12 24 12 24 18S20 38 20 50"
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M44 14c0 12-24 12-24 18s24 6 24 18"
          fill="none"
          stroke="#5eead4"
          strokeOpacity=".55"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M24 22h16M24 42h16"
          stroke="#9aa7b4"
          strokeOpacity=".6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    size,
  );
}
