import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

let idCounter = 0;

interface Props {
  code: string;
}

export function MermaidBlock({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`mermaid-${++idCounter}`);

  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(id.current, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(() => {
      if (ref.current) ref.current.textContent = code;
    });
  }, [code]);

  return <div ref={ref} className="my-4 flex justify-center" />;
}
