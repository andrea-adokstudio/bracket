/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: "/bracket", destination: "/tabellone", permanent: true }]
  },
}

export default nextConfig
