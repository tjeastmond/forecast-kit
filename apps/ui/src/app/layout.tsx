import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Roboto_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { parseTheme, THEME_STORAGE_KEY, themeInitScript } from '@/lib/theme';
import '@/styles.css';

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'FORECAST-KIT Explorer',
  description: 'Browse and validate synced prediction market data',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialTheme = parseTheme(cookieStore.get(THEME_STORAGE_KEY)?.value);

  return (
    <html lang="en" className={initialTheme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${robotoMono.variable} font-sans antialiased`}>
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
