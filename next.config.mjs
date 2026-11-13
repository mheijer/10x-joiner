/** @type {import('next').NextConfig} */
const nextConfig = {
  // Résumé text extraction libraries run as plain Node packages on the server (not bundled).
  serverExternalPackages: ["unpdf", "mammoth"],
};
export default nextConfig;
