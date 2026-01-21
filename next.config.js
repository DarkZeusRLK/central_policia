/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['cdn.discordapp.com', 'static.vecteezy.com', 'static.poder360.com.br', 'www.cnnbrasil.com.br', 'gov.br', 'agenciaja.com', 's2-g1.glbimg.com', 'upload.wikimedia.org', 'www.gov.br'],
    unoptimized: true,
  },
};

module.exports = nextConfig;
