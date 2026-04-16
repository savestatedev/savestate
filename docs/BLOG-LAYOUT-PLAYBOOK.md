# Blog Layout Playbook

A step-by-step guide for an AI agent to replicate the UndercoverAgent blog design pattern on any new Next.js site. This produces a branded, category-organized, agent-readable blog with animations and strong typography.

---

## Prerequisites

- Next.js App Router project with Tailwind CSS
- Blog posts as markdown/MDX files with YAML frontmatter (`title`, `date`, `tags`, `description`, `author`)
- A brand guide with: primary/secondary colors, fonts, mascot or hero image, tagline
- `gray-matter` and `marked` (or your markdown parser of choice) installed

---

## Step 1: Build the Blog Data Layer

Create `src/lib/blog.ts` with these functions:

1. **`parsePost(filename)`** — Read markdown file, extract frontmatter with `gray-matter`, convert body to HTML with `marked`, calculate read time (`wordCount / 250`), derive slug from filename
2. **`getAllPosts()`** — Read all files from content directory, parse each, sort by date descending
3. **`getPostBySlug(slug)`** — Find single post by slug
4. **`getFeaturedPost()`** — Return the most recent post
5. **`getRelatedPosts(currentSlug, tags, limit)`** — Score all other posts by tag overlap, return top N
6. **`getCategories()`** — Define a category map (name, color, keywords), auto-categorize each post by matching its tags against keywords, return grouped results
7. **`getAllTags()`** — Aggregate all tags across posts with counts, sorted by frequency

The category map is the key design decision — define 4-6 categories that cover your content, each with a display name, a color key, and a list of lowercase keyword fragments to match against post tags.

---

## Step 2: Add Blog CSS to Your Global Stylesheet

Add these component classes to your globals.css (inside `@layer components`):

1. **`.blog-hero`** — Dark gradient background with subtle grid pattern overlay (`::before` pseudo-element with `linear-gradient` grid lines)
2. **`.blog-card`** — White card with border, rounded corners, hover effect (border color change, shadow increase, `translateY(-4px)`)
3. **`.blog-card-featured`** — Dark gradient card (your primary dark color), light border, gold/accent hover
4. **`.blog-tag` + color variants** — Monospace, uppercase, small, with semi-transparent background tinted to the tag color. Create variants for each brand color (e.g., `.blog-tag-cyan`, `.blog-tag-gold`)
5. **`.blog-sidebar-card`** — Light card for sidebar sections
6. **`.blog-sidebar-dark`** — Dark gradient card for the "For AI Agents" sidebar block
7. **`.blog-prose`** — Full article typography: sized headings with bottom borders on h2, cyan-colored list markers, blockquotes with colored left border, code blocks with dark background, tables with header styling, gradient `<hr>` elements, proper spacing throughout

Use `transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1)` for card hovers — it feels more polished than linear easing.

---

## Step 3: Create the Shared Blog Header

Create `src/app/blog/blog-header.tsx` as a `"use client"` component:

- Fixed top nav (`position: fixed`, `z-50`, white/translucent with `backdrop-blur`)
- Left: logo image + brand name (with accent color on second word)
- Center: nav links (How It Works, Features, Pricing, Blog highlighted, Demo, Dashboard)
- Right: CTA button + mobile hamburger toggle
- Mobile: collapsible menu panel below nav bar

This is extracted from your homepage nav so the blog shares the same navigation as the main site.

---

## Step 4: Create the Blog Layout

Create `src/app/blog/layout.tsx`:

1. Import and render `<BlogHeader />`
2. Add a spacer div matching the nav height (`h-16 md:h-20`)
3. Render `{children}` in a flex-1 container
4. Add a branded footer with 4-column grid: Brand/tagline, Product links, Resources links, Legal links
5. Footer bottom bar: copyright + social icons

This layout wraps every page under `/blog/*` automatically.

---

## Step 5: Build the Blog Index Page

Create `src/app/blog/page.tsx` with these sections:

### Hero (dark, full-width)
- Dark gradient background using `.blog-hero`
- Two-column flex: text left, mascot/image right (floating with animation)
- Dossier/themed badge above heading ("Intel Briefings" or your equivalent)
- Large heading with accent colors on key words
- Subtitle in muted white
- Post count + category count stats line
- Staggered fade-in-up animations on each element

### Featured Post (overlapping hero)
- Negative top margin (`-mt-12`) to overlap the hero section
- Full-width dark card (`.blog-card-featured`)
- "Latest" tag badge + date + read time
- Large bold title with hover color shift
- Excerpt (line-clamped to 3 lines)
- Tag badges
- Arrow circle icon on the right (hidden on mobile)

### Main Content + Sidebar (two-column on desktop)
**Main column** — Loop over categories from `getCategories()`:
- Category header: colored dot + category name + post count badge
- 2-column card grid (`sm:grid-cols-2`) showing up to 4 posts per category
- Each card: tag badges (colored by category), date, bold title with hover color, excerpt (line-clamp-2), "Read more" with arrow that shifts on hover

**Sidebar** (`w-80`, sticky-friendly):
1. "For AI Agents" dark card — links to llms.txt, JSON feed, robots.txt
2. Resources card — links to demo, dashboard, docs, pricing (each with colored icon square)
3. Popular Tags — flex-wrap grid of tag badges from `getAllTags().slice(0, 12)`
4. SOM Ready badge — green dot + "SOM Ready" label linking to somready.com
5. Newsletter/CTA card — gradient border tint, heading, description, primary CTA button

---

## Step 6: Build the Blog Post Page

Create `src/app/blog/[slug]/page.tsx`:

### Header (dark, matching blog hero)
- Breadcrumb nav: Blog > Post title (truncated)
- Tag badges (up to 4)
- Large bold title
- Author row: avatar circle + name + date + read time

### Article Body
- `<article className="blog-prose">` wrapping `dangerouslySetInnerHTML={{ __html: post.content }}`
- The `.blog-prose` CSS handles all typography automatically
- Max-width container (`max-w-3xl`) centered

### Post Footer CTA
- Dark gradient card with centered text
- Headline + description + two buttons (primary CTA + secondary)

### Related Posts
- Section heading with gradient divider
- 3-column grid of related post cards (from `getRelatedPosts()`)
- Same card design as index page
- "Back to all posts" link centered below

### SEO
- `generateMetadata()` returning title, description, openGraph (article type, publishedTime, authors, tags)
- `generateStaticParams()` pre-rendering all post slugs at build time

---

## Step 7: Implement Agent Readability (SOM)

### robots.txt (`src/app/robots.txt/route.ts`)
Return plain text with standard directives plus SOM directives:
```
SOM-Endpoint: https://yoursite.com/llms.txt
SOM-Format: SOM/1.0
SOM-Scope: main-content
SOM-Freshness: 3600
SOM-Token-Budget: 15000
SOM-Attribution: required
SOM-Contact: your@email.com
```

### llms.txt (`src/app/llms.txt/route.ts`)
Return a plain text file with:
- Site name and tagline
- About section (what the product does)
- Key capabilities list
- API reference (if applicable)
- Pricing summary
- Blog categories with counts
- Recent articles list (title, URL, date, description)
- Key links

### JSON Feed (`src/app/api/blog/feed.json/route.ts`)
Return JSON Feed 1.1 format with all posts including `content_html`, tags, dates, and authors. Set `Cache-Control: public, max-age=3600`.

---

## Step 8: Verify

1. **Build** — `pnpm build` must pass with blog pages, llms.txt, robots.txt, and feed.json all appearing in the route list
2. **Visual** — Check the blog index hero, featured card, category sections, sidebar, and individual post typography
3. **Navigation** — Header and footer render on all blog pages, all links work
4. **Mobile** — Cards stack to single column, hamburger menu works, hero is readable
5. **Agent readability** — Fetch `/robots.txt`, `/llms.txt`, and `/api/blog/feed.json` and verify content

---

## Design Principles to Follow

- **Hero sets the tone** — Dark, bold, with your mascot/brand image and a themed badge. This is the first thing readers see.
- **Featured post earns its space** — The latest post gets a full-width dark card overlapping the hero. It should feel important.
- **Categories create structure** — A flat chronological list is boring. Grouping posts by topic with colored dots makes the content feel organized and browsable.
- **Sidebar adds utility** — Resources, tags, agent links, and a CTA give the sidebar real value beyond decoration.
- **Cards invite clicks** — Hover animations (lift, border color, shadow, title color shift, arrow nudge) make each card feel interactive.
- **Prose must be beautiful** — Article typography is where readers spend time. Generous line height (1.85), proper heading hierarchy, colored list markers, styled blockquotes and code blocks.
- **Animations are subtle** — Fade-in-up on load, smooth transitions on hover. Never flashy, never distracting.
- **Agent-readable by default** — SOM directives, llms.txt, and JSON feed make your content available to AI agents without scraping.
