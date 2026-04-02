#!/usr/bin/env node
/**
 * Generate blog index from all blog posts
 * Run: npx ts-node scripts/generate-blog-index.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '..', 'site', 'blog');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');

// Read all HTML files except index.html
const files = fs.readdirSync(BLOG_DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== '_TEMPLATE.html');

// Extract frontmatter/metadata from each post
interface Post {
  filename: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  dateStr: string;
  content: string;
}

function extractMetadata(html: string): Partial<Post> {
  const result: Partial<Post> = { content: html };
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.title = titleMatch[1].replace(' — SaveState', '').trim();
  }
  
  // Extract description (excerpt)
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) {
    result.excerpt = descMatch[1];
  }
  
  // Extract date from frontmatter or content
  const dateMatch = html.match(/date:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})/i) ||
                    html.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    result.date = dateMatch[1];
    result.dateStr = formatDate(dateMatch[1]);
  }
  
  return result;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function slugify(filename: string): string {
  return filename.replace(/\.html$/, '');
}

// Parse all posts
const posts: Post[] = files.map(filename => {
  const html = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
  const meta = extractMetadata(html);
  return {
    filename,
    slug: slugify(filename),
    title: meta.title || filename,
    excerpt: meta.excerpt || '',
    date: meta.date || '1970-01-01',
    dateStr: meta.dateStr || 'Unknown',
    content: meta.content || ''
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Generate posts HTML
const postsHtml = posts.map(post => `
    <div class="blog-card">
      <div class="blog-date">${post.dateStr}</div>
      <h2 class="blog-title">
        <a href="/blog/${post.slug}">${post.title}</a>
      </h2>
      <p class="blog-excerpt">${post.excerpt}</p>
      <a href="/blog/${post.slug}" class="read-more">Read more →</a>
    </div>
`).join('\n');

// Read existing index.html to get the header/footer
const existingIndex = fs.readFileSync(INDEX_PATH, 'utf-8');

// Extract header (everything before main content)
const headerEnd = existingIndex.indexOf('<div class="blog-card"');
const header = existingIndex.substring(0, headerEnd);

// Extract footer (everything after posts container closes)
const footerStart = existingIndex.indexOf('</div>\n  </main>');
const footer = existingIndex.substring(footerStart);

// Generate new index
const newIndex = header + '\n' + postsHtml + '\n' + footer;

// Write new index
fs.writeFileSync(INDEX_PATH, newIndex);

console.log(`✅ Generated blog index with ${posts.length} posts`);
console.log(`📝 ${posts.length} posts sorted by date (newest first)`);
