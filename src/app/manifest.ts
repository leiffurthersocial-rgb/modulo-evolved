import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Modulo Evolved",
    short_name: "Modulo",
    description: "Scientific 3D evolution simulator and genetics sandbox.",
    start_url: "/",
    display: "fullscreen",
    orientation: "any",
    background_color: "#07090c",
    theme_color: "#07090c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
