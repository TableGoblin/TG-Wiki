# Daily Foundry release check (D1008)

`tools/foundry_watch.py` replaces the weekly AoN check timer (never installed). Once a day it asks GitHub (`git ls-remote`, no download)
for the newest `pf2e-X.Y.Z` and `sf2e-X.Y.Z` release tags and compares them with the data the bot runs (`pf2e_system/RELEASE`, `SF2E_RELEASE`).

When a newer release exists it:

1. Downloads it at once into the temporary folder `/opt/tablegoblin/pf2e_system.watch/<pf2e tag>+<sf2e tag>/` (the same sparse fetch as
   `tools/foundry_update.py`; release tags only). The installed data and `data/foundry_release.json` are not touched. Older staged folders are removed.
2. Writes `/opt/tablegoblin/FOUNDRY_WATCH/<date>-<tags>/report.md`: the update report (renamed, removed and moved items, new names that may carry
   setting terms for the ORC pass, rules changed on items live characters hold), a Starfinder section, and GitHub's release notes for every
   release between the installed one and the new one.
3. Sends the owner a direct message from the bot (the Discord application's owner, or the team owner), listing what needs review and the
   report's path. If a direct message can't be sent it posts in the private error channel (`ERROR_CHANNEL_ID`). Players are never told.

A release is announced once (`.cache/foundry_watch.json`); an undelivered message is retried the next day. Applying a release stays a
separate, tested deploy: review the report, change the pin in `data/foundry_release.json`, run the full suite, then deploy as usual.

## Install on the VM

```sh
cd /opt/tablegoblin
sudo cp deploy/tablegoblin-foundry-watch.service deploy/tablegoblin-foundry-watch.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tablegoblin-foundry-watch.timer
systemctl list-timers tablegoblin-foundry-watch.timer
```

Try it by hand:

```sh
sudo -u tablegoblin venv/bin/python tools/foundry_watch.py --check-only      # prints installed vs newest, changes nothing
sudo -u tablegoblin venv/bin/python tools/foundry_watch.py --test-notify     # one test message to the owner
sudo systemctl start tablegoblin-foundry-watch.service && journalctl -u tablegoblin-foundry-watch.service -n 20
```

Remove it: `sudo systemctl disable --now tablegoblin-foundry-watch.timer` and delete the two unit files.
