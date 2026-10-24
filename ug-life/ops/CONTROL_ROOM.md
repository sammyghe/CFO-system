# Control Room and the ops API

Live site: https://ug-life.netlify.app
Control Room for Sammy: `/admin.html`. Sign in with the `UGLIFE_ADMIN_TOKEN` password.

Agents use the same endpoints with `Authorization: Bearer $UGLIFE_ADMIN_TOKEN`
and the site address in `$UGLIFE_URL`. If either variable is missing, the agent
writes one line to `ops/queue/approvals.md` asking for it and stops.

| What | Call |
|---|---|
| Today's numbers and switches | `GET /api/admin/overview` |
| Snaps waiting for review | `GET /api/admin/photos?status=pending` |
| Look at one snap | `GET /api/photo/<id>` (with the admin header) |
| Approve / reject / feature / remove a snap | `POST /api/admin/photos/<id>` `{"action":"approve"}` or `{"action":"reject","reason":"…"}` |
| Open support tickets (P0 first) | `GET /api/admin/tickets?status=open` |
| Reply to a ticket | `POST /api/admin/tickets/<id>` `{"reply":"…","status":"answered"}` |
| Escalate a ticket | `POST /api/admin/tickets/<id>` `{"status":"escalated","priority":"P0"}` |
| Economy flags (refused or unusual saves) | `GET /api/admin/flags`, resolve with `POST /api/admin/flags/<id>` |
| Player reports | `GET /api/admin/reports`, close with `POST /api/admin/reports/<id>` |
| Freeze / unfreeze a player | `POST /api/admin/players/<id>` `{"frozen":true}` |
| Switches | `POST /api/admin/config` `{"key":"maintenance_mode","value":"true"}` (also `uploads_enabled`, `signups_enabled`, `announcement`) |
| Daily event counts | `GET /api/admin/metrics?days=7` |

## Who may do what

| Action | Agent | Sammy |
|---|---|---|
| Answer how-to tickets from the FAQ | yes | yes |
| Reject a snap that clearly breaks a photo rule | yes, with the reason | yes |
| Approve a snap (it becomes public) | no: recommend it in `approvals.md` | yes, in the Control Room |
| Freeze a player during a live exploit | yes, and write `queue/p0.md` | yes |
| Unfreeze, ban, refund | no | yes |
| Turn on maintenance mode during an exploit or attack | yes, and write `queue/p0.md` | yes |
| Turn uploads or sign-ups back on | no | yes |

Approving snaps stays with Sammy because approval publishes a photo of a real
place. Batch-approving takes a minute in the Control Room. If the queue grows past
what fits in the Monday review, the rule can be relaxed so that the moderation
agent approves snaps with no people or vehicles in them; that change is Sammy's call.
