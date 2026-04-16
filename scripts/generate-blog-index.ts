#!/usr/bin/env node
/**
 * Generate blog index from all blog posts
 * Updates featured post and category sections while preserving the full page structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_DIR = path.join(__dirname, '..', 'site', 'blog');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');

// Category definitions with keywords for auto-categorization
const CATEGORIES = [
  {
    name: 'Memory Management',
    color: 'blue',
    keywords: ['memory', 'backup', 'context', 'governance', 'state-management', 'rollback', 'snapshot']
  },
  {
    name: 'Security',
    color: 'red',
    keywords: ['security', 'attack', 'poison', 'vulnerability', 'cicd', 'ci-cd', 'pipeline', 'risk', 'incident']
  },
  {
    name: 'State Management',
    color: 'gold',
    keywords: ['state', 'api', 'outage', 'deployment', 'openai', 'strategy', 'lesson', 'failure']
  },
  {
    name: 'Migration',
    color: 'green',
    keywords: ['migration', 'migrate', 'chatgpt', 'claude', 'wizard', 'portable', 'transfer']
  },
  {
    name: 'Product Updates',
    color: 'purple',
    keywords: ['release', 'v0.', 'version', 'savestate', 'mcp', 'architecture', 'feature', 'update']
  }
];

interface Post {
  filename: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  dateStr: string;
  dateShort: string;
  category: typeof CATEGORIES[0];
}

function extractMetadata(html: string, filename: string): Partial<Post> {
  const result: Partial<Post> = {};

  // Extract title from h1 or title tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (h1Match) {
    result.title = h1Match[1].trim();
  } else if (titleMatch) {
    result.title = titleMatch[1].replace(' — SaveState', '').replace(' | SaveState', '').trim();
  }

  // Extract description (excerpt)
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) {
    result.excerpt = descMatch[1];
  }

  // Extract date from div.date or ISO format in content
  const divDateMatch = html.match(/<div class="date">([^<]+)<\/div>/i);
  const isoDateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);

  if (divDateMatch) {
    const dateText = divDateMatch[1].trim();
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) {
      result.date = parsed.toISOString().split('T')[0];
      result.dateStr = dateText;
      result.dateShort = formatDateShort(result.date);
    }
  } else if (isoDateMatch) {
    result.date = isoDateMatch[1];
    result.dateStr = formatDate(isoDateMatch[1]);
    result.dateShort = formatDateShort(isoDateMatch[1]);
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

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).replace(',', ',');
}

function categorizePost(post: Partial<Post>, filename: string): typeof CATEGORIES[0] {
  const searchText = `${post.title || ''} ${post.excerpt || ''} ${filename}`.toLowerCase();

  // Score each category
  let bestCategory = CATEGORIES[0];
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let score = 0;
    for (const keyword of cat.keywords) {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

function slugify(filename: string): string {
  return filename.replace(/\.html$/, '');
}

// Read all HTML files except index.html and template
const files = fs.readdirSync(BLOG_DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== '_TEMPLATE.html');

// Parse all posts
const posts: Post[] = files.map(filename => {
  const html = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8');
  const meta = extractMetadata(html, filename);
  const category = categorizePost(meta, filename);
  return {
    filename,
    slug: slugify(filename),
    title: meta.title || filename.replace(/-/g, ' ').replace('.html', ''),
    excerpt: meta.excerpt || '',
    date: meta.date || '1970-01-01',
    dateStr: meta.dateStr || 'Unknown',
    dateShort: meta.dateShort || 'Unknown',
    category,
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Get featured post (most recent)
const featuredPost = posts[0];

// Group posts by category
const postsByCategory = new Map<string, Post[]>();
for (const cat of CATEGORIES) {
  postsByCategory.set(cat.name, []);
}
for (const post of posts.slice(1)) { // Skip featured post
  const catPosts = postsByCategory.get(post.category.name) || [];
  catPosts.push(post);
  postsByCategory.set(post.category.name, catPosts);
}

// Generate card HTML for a post
function generateCard(post: Post): string {
  const tag = post.category.keywords[0].toUpperCase().slice(0, 8);
  return `            <a href="/blog/${post.slug}" class="blog-card">
              <div class="meta">
                <span class="blog-tag ${post.category.color}">${tag}</span>
                <span>${post.dateShort}</span>
              </div>
              <h3>${post.title}</h3>
              <p>${post.excerpt}</p>
              <span class="read-more">Read more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
            </a>`;
}

// Generate category section HTML
function generateCategorySection(category: typeof CATEGORIES[0], categoryPosts: Post[]): string {
  const topPosts = categoryPosts.slice(0, 4);
  if (topPosts.length === 0) return '';

  const cards = topPosts.map(generateCard).join('\n');

  return `        <!-- ${category.name} Category -->
        <section class="category-section">
          <div class="category-header">
            <div class="category-dot ${category.color}"></div>
            <h2 class="category-name">${category.name}</h2>
            <span class="category-count">${categoryPosts.length} posts</span>
          </div>
          <div class="category-grid">
${cards}
          </div>
        </section>`;
}

// Read existing index
let content = fs.readFileSync(INDEX_PATH, 'utf-8');

// Update featured post
const featuredPattern = /<section class="featured-section">[\s\S]*?<\/section>/;
const featuredReplacement = `<section class="featured-section">
  <div class="container">
    <a href="/blog/${featuredPost.slug}" class="featured-card fade-in fade-in-delay-2">
      <div class="featured-content">
        <div class="featured-label">
          <span class="featured-tag">Latest</span>
          <span>${featuredPost.dateStr}</span>
        </div>
        <h2>${featuredPost.title}</h2>
        <p>${featuredPost.excerpt}</p>
      </div>
      <div class="featured-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </div>
    </a>
  </div>
</section>`;

content = content.replace(featuredPattern, featuredReplacement);

// Update hero stats
const statsPattern = /<div class="hero-stats">[\s\S]*?<\/div>/;
const statsReplacement = `<div class="hero-stats">
          <span><strong>${posts.length}+</strong> articles</span>
          <span><strong>${CATEGORIES.length}</strong> categories</span>
          <span><strong>Daily</strong> updates</span>
        </div>`;
content = content.replace(statsPattern, statsReplacement);

// Generate all category sections
const categorySections = CATEGORIES
  .map(cat => generateCategorySection(cat, postsByCategory.get(cat.name) || []))
  .filter(section => section.length > 0)
  .join('\n\n');

// Replace category sections (everything between blog-main opening and sidebar)
const mainContentPattern = /(<div class="blog-main">)[\s\S]*?(<\/div>\s*<!-- Sidebar -->)/;
const mainContentReplacement = `$1\n\n${categorySections}\n\n      $2`;

content = content.replace(mainContentPattern, mainContentReplacement);

// Write updated index
fs.writeFileSync(INDEX_PATH, content);

console.log(`Generated blog index with ${posts.length} posts across ${CATEGORIES.length} categories`);
console.log(`Featured: "${featuredPost.title}" (${featuredPost.dateStr})`);
for (const cat of CATEGORIES) {
  const count = postsByCategory.get(cat.name)?.length || 0;
  console.log(`  ${cat.name}: ${count} posts`);
}
