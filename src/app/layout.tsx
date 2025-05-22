import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import {
  Cog,
  Github,
  ListChecks,
  Brain,
  Gauge,
  ShieldAlert,
  Rocket,
  LayoutDashboard,
  Users,
  KeyRound
} from 'lucide-react';

import './globals.css';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from "@/components/ui/toaster";
import { AppQueryProvider } from '@/components/query-provider';


const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TeamOptiVision',
  description: 'Optimize your team\'s vision and performance.',
};

const navItems = [
  { href: '/config', icon: Cog, label: 'Team Configuration' },
  { href: '/metrics/github', icon: Github, label: 'GitHub Metrics' },
  { href: '/metrics/jira', icon: ListChecks, label: 'Jira Metrics' },
  { href: '/metrics/sonarqube', icon: Gauge, label: 'SonarQube Metrics' },
  { href: '/metrics/boomerang', icon: Rocket, label: 'Boomerang Metrics' },
  { href: '/ai-insights', icon: Brain, label: 'AI Insights' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppQueryProvider>
          <SidebarProvider defaultOpen>
            <Sidebar>
              <SidebarHeader className="p-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" asChild>
                     <SidebarTrigger />
                  </Button>
                  <Link href="/config" className="flex items-center gap-2 group text-lg font-semibold text-sidebar-primary hover:text-sidebar-primary/90 transition-colors">
                    <Rocket className="h-6 w-6 text-primary group-hover:animate-pulse" />
                    <span className="group-data-[collapsible=icon]:hidden">TeamOptiVision</span>
                  </Link>
                </div>
              </SidebarHeader>
              <SidebarContent className="p-2">
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarContent>
              <SidebarFooter className="p-4 border-t border-sidebar-border">
                 <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="user avatar"/>
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium">Jane Doe</span>
                    <span className="text-xs text-sidebar-foreground/70">Team Lead</span>
                  </div>
                </div>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset className="flex flex-col">
              <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <SidebarTrigger className="md:hidden" />
                <div className="flex-1">
                  {/* Placeholder for breadcrumbs or page title if needed */}
                </div>
                <Button variant="outline" size="icon">
                  <Users className="h-5 w-5" />
                  <span className="sr-only">User Profile</span>
                </Button>
              </header>
              <main className="flex-1 overflow-auto p-4 md:p-6">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </AppQueryProvider>
      </body>
    </html>
  );
}
