/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/sofascore-proxy/:path*",
        destination: "https://api.sofascore.app/api/v1/:path*",
      },
    ]
  },
}

export default nextConfig
