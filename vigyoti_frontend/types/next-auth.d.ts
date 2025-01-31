import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      subscription?: {
        plan: 'solo' | 'team' | 'enterprise';
        status: 'active' | 'cancelled' | 'expired';
        startDate: any;
        endDate: any;
      };
    } & DefaultSession['user'];
  }

  interface JWT {
    uid: string;
    email: string;
    name: string;
    picture: string;
    subscription?: {
      plan: 'solo' | 'team' | 'enterprise';
      status: 'active' | 'cancelled' | 'expired';
      startDate: any;
      endDate: any;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
  }
} 