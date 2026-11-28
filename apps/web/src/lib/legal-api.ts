'use client';
import { useEffect, useState } from 'react';
export interface LegalPage { id:number; title:string; slug:string; content:string; published:boolean; }
const apiBase = () => (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export async function getLegalPages(): Promise<LegalPage[]> { const r=await fetch(`${apiBase()}/legal`, { cache: 'no-store' }); if(!r.ok) throw new Error('Unable to load legal pages'); return (await r.json()).data || []; }
export async function getLegalPage(slug:string): Promise<LegalPage> { const r=await fetch(`${apiBase()}/legal/${encodeURIComponent(slug)}`, { cache: 'no-store' }); if(!r.ok) throw new Error('Legal page not found'); return (await r.json()).data; }
export function useLegalPages(){ const [pages,setPages]=useState<LegalPage[]>([]); const [loading,setLoading]=useState(true); useEffect(()=>{getLegalPages().then(setPages).catch(()=>setPages([])).finally(()=>setLoading(false));},[]); return {pages,loading}; }
