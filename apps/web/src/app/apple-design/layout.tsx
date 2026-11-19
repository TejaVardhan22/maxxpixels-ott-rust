import type { Metadata } from 'next';
import './apple-design.css';

export const metadata: Metadata = {
  title: 'Product Gallery — Design system showcase',
  description: 'Reference layout matching DESIGN.md (Apple gallery tokens)',
};

export default function AppleDesignLayout({ children }: { children: React.ReactNode }) {
  return <div className="apple-design-scope min-h-screen">{children}</div>;
}
