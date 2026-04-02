#!/usr/bin/env node
/**
 * Generate blog index from all blog posts
 * Replaces only the blog listing container, preserving full page structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '..', 'site', 'blog');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');

// Read all HTML files except index.html and template
const files = fs.readdirSync(BLOG_DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== '_TEMPLATE.html');

interface Post {
  filename: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  dateStr: string;
}

function extractMetadata(html: string): Partial<Post> {
  const result: Partial<Post> = {};
  
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
  
  // Extract date
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
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
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Generate posts HTML
const postsHtml = posts.map(post => `
        <a href="/blog/${post.slug}" class="blog-card">
          <div class="date">${post.dateStr}</div>
          <h2>${post.title}</h2>
          <p>${post.excerpt}</p>
        </a>`).join('\n');

// Read existing index
const content = fs.readFileSync(INDEX_PATH, 'utf-8');

// Find and replace the blog listing section
// Pattern: from <div class="blog-grid"> to </div> (closing of blog-grid)
const pattern = /(<div class="blog-grid">)[\s\S]*?(<\/div>\s*<\/main>)/;
const replacement = `$1\n${postsHtml}\n      $2`;

const newContent = content.replace(pattern, replacement);

// Write
fs.writeFileSync(INDEX_PATH, newContent);

console.log(`Generated blog index with ${posts.length} posts`);
