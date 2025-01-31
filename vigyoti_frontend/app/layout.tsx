import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './api/auth/[...nextauth]/route';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Vigyoti - AI-Powered Tweet Generation',
  description: 'Generate and schedule tweets using AI',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';

  // List of public paths that don't require authentication
  const publicPaths = ['/login', '/signup', '/auth', '/pricing'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Only redirect if:
  // 1. User is authenticated and trying to access public paths (except /auth)
  // 2. User is not authenticated and trying to access protected paths
  if (session && isPublicPath && !pathname.startsWith('/auth')) {
    redirect('/dashboard');
  }

  if (!session && !isPublicPath && pathname !== '/') {
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
