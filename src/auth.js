import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// 导出 NextAuth 的各种处理器及方法
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // 配置自定义凭据（Username/Password）登录提供商
    CredentialsProvider({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        // 清理并去除输入凭据中的首尾空白字符，以防空格或换行等引发问题
        const submittedUsername = (credentials?.username || '').trim();
        const submittedPassword = (credentials?.password || '').trim();

        // 将管理员和普通用户名称固定，不再从环境变量中动态改写
        const fixedAdminUser = 'admin';
        const fixedRegularUser = 'user';

        // 密码仍旧优先从环境变量加载，默认回退密码保持相同
        const envAdminPass = (process.env.BASIC_PASS || '').trim() || 'admin';
        const envRegularPass = (process.env.REGULAR_PASS || '').trim() || 'user';

        // 调试日志输出当前登录尝试的安全性校验细节
        console.log('[Auth Debug] Attempting login:', {
          submittedUsername,
          submittedPasswordLength: submittedPassword.length,
          configuredAdminUser: fixedAdminUser,
          configuredAdminPassLength: envAdminPass.length,
          isMatchAdmin: (submittedUsername === fixedAdminUser && submittedPassword === envAdminPass),
          isMatchRegular: (submittedUsername === fixedRegularUser && submittedPassword === envRegularPass)
        });

        // 验证管理员身份
        if (submittedUsername === fixedAdminUser && submittedPassword === envAdminPass) {
          const user = {
            id: '1',
            name: fixedAdminUser,
            email: 'admin@example.com',
            role: 'admin',
            createdAt: new Date().toISOString()
          };
          return user;
        }

        // 验证普通用户
        if (submittedUsername === fixedRegularUser && submittedPassword === envRegularPass) {
          const user = {
            id: '2',
            name: fixedRegularUser,
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
    signIn: '/login', // 登录页面的路由
    signOut: '/'     // 注销后重定向的路径
  },
  session: {
    strategy: 'jwt',        // 使用 JWT 策略维护会话状态
    maxAge: 24 * 60 * 60,   // 会话的过期时间，单位为秒，这里设置为24小时
  },
  // 签名秘钥，若环境变量中未指定则使用备用秘钥
  secret: process.env.AUTH_SECRET || process.env.SECRET || '00Fv/YUm0enwy04IgP4KoNOWLODe2iJ1tvBzr+4kEZ8=',
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: `authjs.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  callbacks: {
    // JWT 回调，在凭据校验成功生成 Token 或更新 Token 时写入用户自定义属性
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
    // Session 回调，将 Token 中保存的用户属性复制到客户端可见的会话对象中
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.role = token.role; 
      session.user.createdAt = token.createdAt; 
      return session;
    },
    // 路由授权拦截逻辑，配置为 true 代表允许完全放行，最终由 middleware 接管路由级判定
    async authorized({ auth, req }) {
      // 始终返回 true，使 /src/middleware.js 中自定义的中端拦截策略具备完整控制权
      return true;
    },

  },
  trustHost: true // 信任运行的环境主机
});


