import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider(
      {

        authorize: async (credentials) => {
          // Clean and trim credentials/env variables to prevent spacing/newline issues
          const submittedUsername = (credentials?.username || '').trim();
          const submittedPassword = (credentials?.password || '').trim();

          const envAdminUser = (process.env.BASIC_USER || '').trim() || 'admin';
          const envAdminPass = (process.env.BASIC_PASS || '').trim() || 'admin';

          const envRegularUser = (process.env.REGULAR_USER || '').trim() || 'user';
          const envRegularPass = (process.env.REGULAR_PASS || '').trim() || 'user';

          console.log('[Auth Debug] Attempting login:', {
            submittedUsername,
            submittedPasswordLength: submittedPassword.length,
            configuredAdminUser: envAdminUser,
            configuredAdminPassLength: envAdminPass.length,
            isMatchAdmin: (submittedUsername === envAdminUser && submittedPassword === envAdminPass),
            isMatchRegular: (submittedUsername === envRegularUser && submittedPassword === envRegularPass)
          });

          if (submittedUsername === envAdminUser && submittedPassword === envAdminPass) {
            const user = {
              id: 1,
              name: envAdminUser,
              email: 'admin@example.com',
              role: 'admin',
              createdAt: new Date().toISOString()
            };
            return user;
          }

          // 验证普通用户
          if (submittedUsername === envRegularUser && submittedPassword === envRegularPass) {
            const user = {
              id: 2,
              name: envRegularUser,
              email: 'user@example.com',
              role: 'user',
              createdAt: new Date().toISOString()
            };
            return user;

          } else {
            console.log('[Auth Debug] Auth credentials did not match any users');
            return null;
          }
        }
      })
  ],
  pages: {
    signIn: '/login', // 登录页面的路径
    signOut: '/'
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 会话的过期时间，单位为秒，这里设置为24小时
  },
  secret: process.env.AUTH_SECRET || process.env.SECRET || '00Fv/YUm0enwy04IgP4KoNOWLODe2iJ1tvBzr+4kEZ8=', // 替换为你的安全密钥
  useSecureCookies: true,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role; 
        token.createdAt = user.createdAt; 
      }
      return token;
    },
    async session({ session, token }) {

      session.user.id = token.id;
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.role = token.role; 
      session.user.createdAt = token.createdAt; 
      return session;
    },
    async authorized({ auth, req }) {
      // Always return true so that your custom middleware rules in /src/middleware.js have complete control over route-level permission checks and user redirection.
      return true;
    },

  },
  trustHost: true
});


