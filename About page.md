# About Page Plan

## 1. Hero / Header Section
- Full-width hero banner matching the site's dark entertainment theme with gradient/blurred background
- Breadcrumb-style header consistent with other pages (e.g., "HOME > ABOUT")
- Page title: "ABOUT" in uppercase with wide letter-spacing, matching the One Music template style

## 2. Rules & Guidelines Section
- Platform rules and guidelines displayed prominently below the hero
- Content is fully editable by the admin through the Livery tab in the admin dashboard
- Styled with the dark theme, orange (#FF5A09) accent headings, and readable body text

## 3. Competition Calendar
- Full-view, read-only calendar displaying all currently active/upcoming competitions
- Each competition entry shows title, category, dates, and status
- Category filter/sort dropdown to narrow results by type (Music, Dance, Modeling, Bodybuilding, Other)
- View-only — visitors can browse competitions but cannot modify anything
- Calendar pulls live data from the existing competitions API

## 4. Call-to-Action Buttons
- Row of action buttons below the calendar, matching the site's rectangular orange/gradient style with ">>" arrows
- Three buttons:
  - **Start Voting** — links to the Competitions page
  - **Become A Competitor** — links to the Join page
  - **Host An Event** — links to the Host page
- Responsive layout: side-by-side on desktop, stacked on mobile

## 5. Social Media & Contact Info
- Social media links (Facebook, Instagram, Twitter/X, YouTube, TikTok, etc.)
- Contact information (email, phone, address as applicable)
- All content managed by the admin in the Livery tab of the admin dashboard
- Icons from lucide-react or react-icons/si for brand logos
- Styled consistently with the dark theme

## 6. Navigation Update
- Add "ABOUT" link to the main navigation bar alongside HOME, COMPETITIONS, JOIN, HOST
- Route: `/about`

---

# QR Code & Live Voting Feature Plan

## 1. QR Codes Overview
Every competition and every contestant within a competition gets a unique QR code. When scanned, it takes the person directly to that event or that specific contestant's voting page. This turns HiFitComp into a tool for both online and in-person events.

## 2. Competition QR Codes
- Each event gets its own QR code
- Scanning it opens the competition page where you can browse all contestants
- Hosts can download/print these to display at venues, expos, entrances, etc.

## 3. Contestant QR Codes
- Each contestant gets a unique QR code per competition they're in
- Scanning it goes directly to that contestant's profile/voting page within the competition
- Contestants can share their code on social media, flyers, business cards to drive votes
- At in-person events, these get printed and posted at each station/booth

## 4. In-Person Event Use Case
This makes HiFitComp work for live events like expos, science fairs, bodybuilding shows, talent showcases, etc. The workflow:
1. Host pays and creates the event
2. Host sets the rules (voting limits, costs, dates, vote weights)
3. Host sends invitations to participants
4. Participants join and set up their profiles
5. Host prints QR codes and posts them at each station/booth
6. Attendees walk around, scan codes on their phones, and vote (and optionally pay for extra votes)
7. The host makes money from vote purchases without any extra effort

## 5. Where QR Codes Would Live
- **Host dashboard**: download/print QR codes for their competitions and all contestants
- **Talent dashboard**: download/print their own QR codes for competitions they're in
- **Admin dashboard**: access to all QR codes across the platform
- The existing shareable contestant page is the landing destination

## 6. Vote Tracking (QR vs Online)
- QR code URLs include a special tracking parameter that identifies the vote as "in-person"
- Votes cast through a QR code link are tagged as "in-person" votes
- Votes cast through the regular website (browsing directly) are tagged as "online" votes
- The system records the source of every vote

## 7. Vote Weight System
Hosts can configure a weight for online votes relative to in-person (QR) votes. In-person votes always count at 100%. Only online votes get reduced.

### During the Competition
- All votes (online + in-person) are shown as one combined raw total
- There is a visual distinction showing the breakdown (e.g., "2,400 total — 2,000 online / 400 in-person")
- This keeps things exciting and transparent for everyone watching

### When the Winner Is Declared (Weighted Calculation)
The weight reduction only applies at final count time.

**Example 1: 2,000 online + 400 in-person (host sets online at 20% weight)**
- In-person votes at full value: 400
- Online votes at 20%: 2,000 x 0.20 = 400
- **Final weighted total: 800**

**Example 2: 2,000 in-person + 400 online (host sets online at 20% weight)**
- In-person votes at full value: 2,000
- Online votes at 20%: 400 x 0.20 = 80
- **Final weighted total: 2,080**

### Key Principles
1. During the competition, everyone sees the raw total (all votes combined) with a visual breakdown of online vs in-person
2. In-person (QR) votes are never reduced — they always count at 100%
3. Only online votes get the weight reduction set by the host
4. The weighted calculation only matters when declaring the winner / final standings
5. The host sets what percentage online votes are worth (20%, 50%, etc.) when creating/editing their event

### Known Tradeoff
- Someone could screenshot or reprint a QR code and vote remotely while getting "in-person" credit — this is an accepted limitation
- Each competition generates unique QR codes per contestant, so codes from past events don't carry over
- This is a pragmatic design choice: the system is meant to be simple and accessible, not bulletproof against every edge case
