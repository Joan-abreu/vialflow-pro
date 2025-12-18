export const RICH_TEXT_STYLES = `
    prose prose-sm md:prose-base text-muted-foreground max-w-none 
    
    [&_p]:min-h-[1.5em] [&_p]:leading-relaxed [&_p]:mb-4 
    
    [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-foreground
    [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-foreground
    [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground
    
    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:mt-2
    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:mt-2
    
    [&_li]:mt-1 [&_li]:pl-2
    
    [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
    
    [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary/80
`;
