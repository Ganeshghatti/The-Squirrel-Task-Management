import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter email and password");
        }
        console.log(credentials);

        await connectDB();

        const user = await User.findOne({ email: credentials.email });
        console.log(user);
        if (!user) {
          throw new Error("No user found with this email");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }
        console.log("password is valid");
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name || user.email,
          role: user.role,
          youtubeAccess: Boolean((user as any).youtubeAccess),
          linkedinAccess: Boolean((user as any).linkedinAccess),
          instagramAccess: Boolean((user as any).instagramAccess),
          xAccess: Boolean((user as any).xAccess),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
        token.youtubeAccess = (user as any).youtubeAccess;
        token.linkedinAccess = (user as any).linkedinAccess;
        token.instagramAccess = (user as any).instagramAccess;
        token.xAccess = (user as any).xAccess;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).youtubeAccess = (token as any).youtubeAccess;
        (session.user as any).linkedinAccess = (token as any).linkedinAccess;
        (session.user as any).instagramAccess = (token as any).instagramAccess;
        (session.user as any).xAccess = (token as any).xAccess;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // Ensure secret is present, fallback for dev only if needed (better to enforce env var)
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

