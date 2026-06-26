/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.cache = false;
        return config;
    },
    async rewrites() {
        return [
            {
                source: '/file/:name*',
                destination: '/api/file/:name*', 
            },
        ]
    },
};

export default nextConfig;
