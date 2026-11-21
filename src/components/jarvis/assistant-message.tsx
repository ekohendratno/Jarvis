'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantMessage({ content }: { content: string }) {
  return <div className="assistant-message">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
        code: ({ className, children, ...props }) => <code className={className} {...props}>{children}</code>,
      }}
    >{content}</ReactMarkdown>
  </div>
}
