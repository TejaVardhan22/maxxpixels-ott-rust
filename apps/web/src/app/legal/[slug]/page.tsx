'use client';
import { useEffect,useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { EmptyState,GlassPanel,PageHero,PageShell } from '@/components/layout/PageChrome';
import { getLegalPage,type LegalPage } from '@/lib/legal-api';

function sanitizeLegalHtml(html:string):string {
  if (typeof window === 'undefined') return '';
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  documentNode.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(node => node.remove());
  documentNode.body.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'style' || (name === 'href' && !/^(https?:|mailto:|tel:|#)/.test(value))) {
        element.removeAttribute(attribute.name);
      }
    }
    if (element.tagName === 'A') {
      element.setAttribute('rel', 'noopener noreferrer');
      element.setAttribute('target', '_blank');
    }
  });
  return documentNode.body.innerHTML;
}

export default function LegalPageScreen(){
  const params=useParams<{slug:string}>();
  const [page,setPage]=useState<LegalPage|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{getLegalPage(params.slug).then(setPage).catch(()=>setPage(null)).finally(()=>setLoading(false));},[params.slug]);
  return <PageShell narrow><PageHero eyebrow="Legal & Compliance" title={page?.title||'Legal Information'} description="Official MaxxPixels policy and compliance information." icon={FileText}/>{page?<GlassPanel><article className="legal-content text-sm leading-7 text-body-text" dangerouslySetInnerHTML={{__html:sanitizeLegalHtml(page.content)}}/></GlassPanel>:!loading?<EmptyState title="Page unavailable" description="This legal page has not been published yet." icon={FileText}/>:null}</PageShell>;
}
