# How the website files work together

The website has pages, information, pictures, and a shared design. These live in different files, but they work together to create what a visitor sees.

## Start with these four files

| File | Think of it as |
| --- | --- |
| `people.html` | The People page, with places for names, biographies, and photos. |
| `js/site-data.js` | The club's information sheet: people, projects, links, and manually added events. |
| `js/site.js` | The helper that takes information from that sheet and puts it onto the pages. |
| `css/warm-lab.css` | The shared design: colors, fonts, spacing, and sizes. |

**Example: changing someone's biography.** Edit their biography in `js/site-data.js`. When someone opens `people.html`, `js/site.js` puts that biography onto the page. The photo comes from `images/`, and the CSS file controls how everything looks.

You edit the biography in one place, even though several files help display it.

## What the file endings mean

- **HTML (`.html`):** sets up a page's headings, paragraphs, links, and sections.
- **CSS (`.css`):** controls how the page looks.
- **JavaScript (`.js`):** stores information or makes things happen, such as filling in event lists and making buttons work.

A folder simply groups related files. `js/` holds JavaScript files. `images/` holds pictures.

## Which file should I edit

| What you want to change | Where to go |
| --- | --- |
| A person's name, role, biography, or photo filename | `js/site-data.js` |
| Project descriptions, club links, or manually added events | `js/site-data.js` |
| An event copied from Google Calendar, including GBM 3 | The original event in Google Calendar. See below. |
| Mini-project workshop dates, recordings, papers, or deadlines | `js/mini-project-data.js` |
| Opportunities and resources for the cross-organization workshop | `js/workshop-data.js` |
| Colors, fonts, or spacing across the website | `css/warm-lab.css` |
| A heading or paragraph written directly on a page | That page's `.html` file |

The mini-project files connect like this:

```text
js/mini-project-data.js  ->  js/mini-project.js  ->  mini-project.html
   stores information        puts it on the page     visitors see it
```

The workshop page works the same way: `js/workshop-data.js` supplies information, `js/workshop.js` puts it onto `workshop.html`.

## How Google Calendar connects to the website

```text
Google Calendar
    -> automatic copying job
    -> js/calendar-events.js
    -> js/site.js
    -> event sections across the website
```

The copying job is scheduled every six hours. `scripts/fetch_calendar_events.py` does the copying, and `.github/workflows/refresh-events.yml` sets its schedule.

`js/site.js` combines those copied events with the manual events in `js/site-data.js`. The home page, Events page, Join page, and Next up bars share this information. That is why one event appears in several places.

**For GBM 3, delete the original calendar event too.** Deleting only its copied website entry lets the next update bring it back. Follow [the deletion lesson](WEBMASTER-QUICKSTART.md) for the exact steps and push commands.

## What each page is for

| File | Page |
| --- | --- |
| `index.html` | Home: club introduction, events, and featured project. |
| `about.html` | What the club does and common questions. |
| `events.html` | Upcoming and past events. |
| `people.html` | Leaders, mentors, and members. |
| `projects.html` | Current and past projects. |
| `mini-project.html` | Workshops, papers, and updates for the figure-replication project. |
| `join.html` | How to join and attend a meeting. |
| `sponsors.html` | Sponsors and sponsorship information. |
| `chapters.html` | Club chapters and starting a chapter. |
| `workshop.html` | Opportunities and resources shared with workshop attendees. |
| `brain-viz.html` | The moving brain shown inside the home page. |

Some text, such as the footer at the bottom, is written separately in several page files. Changing that text everywhere means editing each copy.

## Pictures and other supporting files

| File or folder | Simple explanation |
| --- | --- |
| `images/` | Logos, flyers, and photos. Member photos are in `images/members/`; project photos are in `images/projects/`. |
| `brain_model.glb` and `white.jpg` | The brain's shape and a picture used for its surface. |
| `js/neuron.js` and `neuron/` | The instructions and shapes for the nerve cells behind the pages. |
| `js/vendor/` | Ready-made tools used by the moving visuals. |
| `js/theme.js` | Switches between light and dark appearance. |
| `scripts/optimize_images.py` | Makes picture files smaller so pages load faster. |

Pages find pictures by filename. If you rename a picture, update the filename in the content or page that uses it. Capital letters must match too.

## How an edit becomes public

**Save the file -> commit your changes -> push to GitHub -> GitHub Pages publishes the update.** Saving alone only changes your computer's copy. The deletion lesson walks through these steps.

The remaining files mostly support this setup: `CNAME` records the website address; `robots.txt` and `sitemap.xml` help search engines find pages; `.gitignore` tells Git which local files to leave out. `.git/` holds Git's records, and `.idea/` holds editor settings.

`README.md` is the longer maintenance guide. `README-REDESIGN.md` contains older design notes. `CNS_summerPrograms.pdf` is a summer-program reference. `WEBMASTER-QUICKSTART.md` is the deletion lesson, and `FILE-GUIDE.md` is this guide.
