import Link from 'next/link';

const navPrimary = [
  { label: 'Home feed', href: '/mock-home-shell', active: true },
  { label: 'Debates', href: '/c' },
  { label: 'Auto blog', href: '/blog' },
  { label: 'Open-source radar', href: '/docs' },
];

const navSecondary = [
  { label: 'AI trend briefs', href: '/analytics' },
  { label: 'Community playbooks', href: '/docs' },
  { label: 'Events + rooms', href: '/support' },
];

const spaces = [
  { name: 'AI governance', members: '312' },
  { name: 'Open eval stacks', members: '188' },
  { name: 'Agent workflows', members: '241' },
  { name: 'OSS maintainers', members: '129' },
];

const quickActions = [
  { label: 'Start a debate', href: '/new-story' },
  { label: 'Submit OSS recap', href: '/drafts' },
];

const momentumStats = [
  { label: 'Active discussions', value: '214', detail: '+18 today' },
  { label: 'Monthly contributors', value: '3.4k', detail: '+12% MoM' },
  { label: 'Open-source posts', value: '128', detail: '42 awaiting review' },
];

const liveSignals = [
  { time: '2m ago', text: 'New thread opened: Why open model governance matters' },
  { time: '8m ago', text: 'MCP auto-blog summarized 5 repo updates' },
  { time: '18m ago', text: 'Community review: AI eval stack playbook v1' },
  { time: '27m ago', text: 'OSS sprint announced for contributor onboarding' },
];

const trendingDebates = [
  {
    title: 'Is community-owned AI infrastructure realistic in 2024?',
    tag: 'Debate',
    replies: 86,
    participants: 42,
    summary:
      'A structured debate on funding, infra costs, and open governance models.',
  },
  {
    title: 'Open-source AI safety tools: what is missing?',
    tag: 'Research',
    replies: 54,
    participants: 31,
    summary:
      'Tracking the gaps in eval tooling, red teaming, and safe deployment workflows.',
  },
  {
    title: 'Community rules that keep discourse sharp, not loud',
    tag: 'Culture',
    replies: 39,
    participants: 21,
    summary:
      'A discussion on moderation patterns that protect curiosity and rigor.',
  },
];

const latestPosts = [
  {
    title: 'Notebook: Building an OSS-first AI roadmap for teams',
    author: 'K. Moon',
    time: 'Today · 13 min read',
    excerpt:
      'A field guide to balancing shipping pressure with sustainable open work.',
  },
  {
    title: 'Community recap: 12 experiments in transparent governance',
    author: 'M. Cho',
    time: 'Yesterday · 9 min read',
    excerpt:
      'Highlights from the monthly roundtable and the lessons we are adopting.',
  },
  {
    title: 'Tooling stack: MCP + GitHub Actions for auto-posting',
    author: 'Auto Blog MCP',
    time: 'Yesterday · 6 min read',
    excerpt:
      'A behind-the-scenes look at the automation layer for fast updates.',
  },
];

const aiTrends = [
  { label: 'Open eval benchmarks', growth: '+28%' },
  { label: 'On-device models', growth: '+22%' },
  { label: 'Agentic workflows', growth: '+19%' },
  { label: 'RAG integrity', growth: '+16%' },
];

const openSourceRadar = [
  {
    repo: 'atlas-verify',
    detail: 'New release: policy-based evaluation workflows',
    stars: '2.1k',
  },
  {
    repo: 'luna-data-stack',
    detail: 'Docs refresh: governance templates + checklists',
    stars: '4.4k',
  },
  {
    repo: 'signal-lab',
    detail: 'First community build: telemetry for safe deployments',
    stars: '1.3k',
  },
];

const mcpPipeline = [
  { label: 'Repo digest', status: 'Synced 12 min ago' },
  { label: 'Summary draft', status: 'Queued · 3 items' },
  { label: 'Editorial pass', status: 'Pending · 2 reviewers' },
];

const events = [
  { title: 'Live debate: Community owned AI infrastructure', time: 'Fri · 20:00' },
  { title: 'OSS contributor office hours', time: 'Sat · 14:00' },
  { title: 'AI trend briefing: July signals', time: 'Mon · 19:00' },
];

const contributors = [
  { name: 'J. Park', role: 'Policy research' },
  { name: 'E. Han', role: 'Open-source maintainer' },
  { name: 'S. Lee', role: 'Product strategy' },
  { name: 'M. Choi', role: 'Community ops' },
];

const sparkline = [20, 36, 28, 42, 30, 50, 44, 62, 48];

export default function MockHomeShellPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 tracking-[0.01em] dark:bg-slate-950 dark:text-slate-100">
      <div className="relative">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-900">
                <span className="text-base font-semibold">A</span>
                <span className="absolute -bottom-1 left-2 h-3 w-3 rotate-45 bg-slate-900 dark:bg-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold">codebase.blog</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  AI + OSS community newsroom
                </p>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center gap-3 md:justify-end">
              <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600/50 dark:border-slate-700 dark:bg-slate-900/80 dark:focus-within:ring-emerald-400/40">
                <span className="text-sm text-slate-500 dark:text-slate-400">Search</span>
                <input
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="AI trends, OSS, governance"
                  aria-label="Search the community"
                />
              </div>
              <Link
                href="/new-story"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-emerald-400 dark:text-slate-900 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
              >
                New discussion
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-16 pt-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                Home pulse
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Track signals, debates, and the newest OSS drops.
              </p>
              <div className="mt-4 space-y-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    prefetch={false}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                  >
                    {action.label}
                    <span className="text-xs text-slate-400">↗</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                Navigation
              </p>
              <nav className="mt-4 space-y-2">
                {navPrimary.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950 ${
                      item.active
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                    <span className="text-xs text-slate-400">→</span>
                  </Link>
                ))}
              </nav>
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                  Library
                </p>
                <div className="mt-3 space-y-2">
                  {navSecondary.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      prefetch={false}
                      className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                    >
                      {item.label}
                      <span className="text-xs text-slate-400">↗</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
                Spaces
              </p>
              <div className="mt-4 space-y-3">
                {spaces.map((space) => (
                  <div
                    key={space.name}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {space.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {space.members} members
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Join
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                MCP pulse
              </p>
              <p className="mt-3 text-sm text-slate-200">
                3 drafts are waiting for editorial review.
              </p>
              <Link
                href="/docs"
                prefetch={false}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-emerald-200 dark:focus-visible:ring-offset-slate-950"
              >
                Review pipeline
              </Link>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                  Community signal
                </p>
                <h1 className="mt-3 text-3xl font-semibold leading-snug sm:text-4xl">
                  Build the culture where AI and open-source evolve together.
                </h1>
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  A home feed designed for fast updates, thoughtful debate, and shared
                  experiments. Highlight what is new, reward deep contributions, and
                  keep the conversation in the open.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/community"
                    prefetch={false}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950"
                  >
                    Explore the feed
                  </Link>
                  <Link
                    href="/docs"
                    prefetch={false}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                  >
                    Community handbook
                  </Link>
                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                    42 live rooms in progress
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {momentumStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                    <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                      {stat.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-8">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                        Trending debates
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        Discussions driving the community forward
                      </h2>
                    </div>
                    <Link
                      href="/c"
                      prefetch={false}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="mt-6 space-y-5">
                    {trendingDebates.map((thread) => (
                      <article
                        key={thread.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {thread.tag}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {thread.replies} replies · {thread.participants} contributors
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{thread.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {thread.summary}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">
                        Latest from the feed
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        Editorial + community posts
                      </h2>
                    </div>
                    <Link
                      href="/blog"
                      prefetch={false}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950"
                    >
                      Browse posts
                    </Link>
                  </div>
                  <div className="mt-6 space-y-5">
                    {latestPosts.map((post) => (
                      <article
                        key={post.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {post.author}
                          </span>
                          <span>{post.time}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {post.excerpt}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                      Live signals
                    </p>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900 dark:bg-blue-500/20 dark:text-blue-200">
                      Updating
                    </span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {liveSignals.map((item) => (
                      <div
                        key={item.text}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.text}
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {item.time}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <p className="text-sm font-semibold">Momentum tracker</p>
                    <div className="mt-4 flex items-end gap-1">
                      {sparkline.map((value, index) => (
                        <span
                          key={`${value}-${index}`}
                          className="block w-3 rounded-full bg-emerald-400 dark:bg-emerald-300"
                          style={{ height: `${value}px` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                    AI trend radar
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Signals that deserve debate
                  </h3>
                  <div className="mt-4 space-y-3">
                    {aiTrends.map((trend) => (
                      <div
                        key={trend.label}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {trend.label}
                        </span>
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {trend.growth}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                    Open-source radar
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">New releases to review</h3>
                  <div className="mt-4 space-y-3">
                    {openSourceRadar.map((repo) => (
                      <div
                        key={repo.repo}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {repo.repo}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {repo.stars} stars
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {repo.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-300 dark:text-emerald-200">
                    Auto blog MCP
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Editorial pipeline status</h3>
                  <div className="mt-4 space-y-3">
                    {mcpPipeline.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-sm text-emerald-200 dark:text-emerald-300">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/docs"
                    prefetch={false}
                    className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-emerald-200 dark:focus-visible:ring-offset-slate-950"
                  >
                    Learn about automation
                  </Link>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">
                    Upcoming moments
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Events + challenges</h3>
                  <div className="mt-4 space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {event.title}
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          {event.time}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                    Top contributors
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    People shaping the culture
                  </h3>
                  <div className="mt-4 space-y-3">
                    {contributors.map((person) => (
                      <div
                        key={person.name}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                          {person.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {person.name}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {person.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                    Community invitation
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Turn trending ideas into shared projects.
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    Highlight the strongest proposals, document the debate, and publish
                    outcomes transparently. This is a feed built for builders and
                    researchers who care about culture.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth"
                    prefetch={false}
                    className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-emerald-400 dark:text-slate-900 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                  >
                    Join the community
                  </Link>
                  <Link
                    href="/pricing"
                    prefetch={false}
                    className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-slate-950"
                  >
                    View plans
                  </Link>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
