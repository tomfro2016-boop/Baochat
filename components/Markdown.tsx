'use client';

import { isValidElement, memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import { Check, Copy } from 'lucide-react';
import ChartBlock, { parseChart } from './ChartBlock';
import ActionCard, { parseAction } from './ActionCard';

function nodeText(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText((node.props as any).children);
  return '';
}

function CodeBlock({ children }: { children: any }) {
  const [copied, setCopied] = useState(false);
  const [runApp, setRunApp] = useState(false);
  const codeEl: any = Array.isArray(children) ? children[0] : children;
  const cls: string = codeEl?.props?.className || '';
  const lang = /language-([\w-]+)/.exec(cls)?.[1] || 'code';
  const text = nodeText(codeEl?.props?.children).replace(/\n$/, '');
  if (lang === 'action') {
    const act = parseAction(text);
    if (act) return <ActionCard action={act} />;
  }
  if (lang === 'chart') {
    const spec = parseChart(text);
    if (spec) return <ChartBlock spec={spec} />;
  }
  return (
    <div className="code-block my-3 overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between bg-[#1c1a16] px-4 py-1.5 text-xs text-[#948e83]">
        <span className="font-mono">{lang}</span>
        {lang === 'html' && (
          <button className="ml-auto mr-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[#F0A528] transition-colors duration-150 hover:bg-white/10" onClick={() => setRunApp((v) => !v)}>
            {runApp ? 'Ẩn' : 'Chạy thử'}
          </button>
        )}
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors duration-150 hover:bg-white/10 hover:text-white"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {lang === 'html' && runApp && <iframe title="app" sandbox="allow-scripts" srcDoc={text} className="h-[420px] w-full border-t border-line bg-white" />}
      <pre>{children}</pre>
    </div>
  );
}

function MarkdownImpl({ children }: { children: string }) {
  return (
    <div className="prose-bc break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }], [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          // Không tải ảnh từ URL bên ngoài do AI sinh ra (tránh theo dõi/rò rỉ dữ liệu)
          img: ({ alt, src }) => (
            <a href={typeof src === 'string' ? src : '#'} target="_blank" rel="noopener noreferrer nofollow">
              [{alt || 'image'}]
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownImpl);
