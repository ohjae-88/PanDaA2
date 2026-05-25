/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tauri 정적 export — webview가 bundled HTML 로드
  output: "export",
  images: { unoptimized: true },
  // Tauri는 trailing slash 라우팅을 선호
  trailingSlash: true,
};

export default nextConfig;
