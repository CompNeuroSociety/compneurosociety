# Delete GBM 3 from the calendar and website

This lesson covers one change: delete GBM 3 completely from Google Calendar and the website, then publish and verify the removal.

## What happens at the next calendar sync

**Delete GBM 3 from Google Calendar first.** The sync rebuilds `js/calendar-events.js` from that calendar. Deleting only the website entry would let the next sync bring it back.

The sync is scheduled every six hours. This is not a six-hour countdown from your edit: the next scheduled run could be sooner, and a delayed or failed run can take longer. You can also run the sync manually in GitHub Actions.

Deleting the calendar event and running **Sync events from Google Calendar** on `main` in GitHub Actions is enough to remove it through automation. The manual steps below let you practice editing and pushing the website change yourself.

## 1 Open the repository and get the latest version

In the VS Code terminal, run:

```powershell
cd "C:\Users\sebas\OneDrive\Desktop\compneurosocietywebsite\compneurosociety"
git status
git switch main
git pull --ff-only origin main
```

Check `git status` before switching or pulling. Finish or save any other work first. The inner `compneurosociety` folder is the Git repository.

## 2 Delete the original calendar event

Using your calendar access, open the club's **CompNeuroSociety Events** calendar in Google Calendar. Delete **GBM 3**, currently scheduled for **October 29, 2026 at 6:30 PM**, and confirm the deletion.

Deleting it at the source prevents the old dated event from returning during the next sync.

## 3 Remove the old website entry

Open `js/calendar-events.js`. Press **Ctrl+F**, search for `GBM 3`, and delete this entire object line, including its trailing comma:

```javascript
  {"title": "GBM 3", "date": "2026-10-29T18:30", "location": "Psychology Department Building, Psychology Dept Bldg, 1107 W Call St, Tallahassee, FL 32304, USA", "blurb": "A204", "image": "images/placeholder.jpg"},
```

Keep the surrounding array, brackets, and other events. Save with **Ctrl+S**. This removes the old listing as soon as you publish; the calendar deletion makes the removal persist through future syncs.

If the row is already gone because a sync ran after the calendar deletion, skip this edit.

## 4 Preview the result

From the repository folder, run:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/events.html` and confirm that the October 29 GBM 3 event is gone.

Also check the home page and `join.html`. Their automatic event sections and the Next up bars should move to the next event, currently GBM 4 in the local data. These sections all use the same event data, so no HTML edits are needed. General wording such as "See you at the next GBM" refers to meetings in general and can stay.

Use a second terminal for Git, or press **Ctrl+C** to stop the preview server.

## 5 Commit and push

After deleting the event line and saving the file, run:

```powershell
git diff
git add js/calendar-events.js
git diff --cached
git commit -m "Remove GBM 3 event listing"
git push origin main
```

If a sync already removed the row and your local copy is up to date, there is nothing to commit or push. Continue to the publication check.

`diff` shows your edits; `add` selects files; `commit` saves a local snapshot; `push` uploads that snapshot to GitHub. See [GitHub's push guide](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository).

If the push is rejected because the calendar bot committed first, finish your commit, confirm a clean working tree, then run `git pull --rebase origin main` followed by `git push origin main`. Resolve any reported conflicts before continuing. If `main` requires pull requests, push your commit on a new branch with `git switch -c update-gbm-3` and `git push -u origin update-gbm-3`, then open a pull request into `main`.

## 6 Check the published website

In the GitHub repository's **Actions** tab, wait for the Pages deployment to succeed. Open `https://compneurosociety.com/events.html` and hard-refresh with **Ctrl+Shift+R**. Confirm that GBM 3 is gone. Check the home page and `join.html` too.

To verify that the change survives a sync, run **Sync events from Google Calendar** on `main` in Actions, or wait for its next scheduled run. Check again after the sync and any resulting deployment finish. GBM 3 should stay absent because it has also been deleted from the source calendar.
