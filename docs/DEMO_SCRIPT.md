# Code:HER — Demo script (60–90 seconds, codeHER.md §12)

Rehearse this verbatim before demo day. Every beat has a fallback — a live
voice SOS has many failure points, and the recovery *is* part of the story.

## Setup (before the audience)

- Two phones: **A** (CodeHER installed, release build) and **B** (any phone,
  one of the trusted contacts, volume up).
- Phone A: Wi-Fi **off**, mobile data **off**. Cellular on.
- Phone A on Home, monitoring active. Kill other audio apps.
- Rehearse the exact speaking distance (~2 m) that passed accuracy trials.

## The beats

| # | Time | Do | Say |
|---|------|----|-----|
| 1 | 0:00 | Hold up phone A. Point at the status badges: "Offline ready", "Voice Listening". | "No Wi-Fi. No mobile data. The cloud is gone — and this still works, because nothing here needs it." |
| 2 | 0:15 | Lock the screen / put phone A face-down. | "Hands-free matters most when your hands aren't available." |
| 3 | 0:25 | Say **"help"** clearly toward the phone. | *(say it, don't narrate)* |
| 4 | 0:30 | Phone vibrates, countdown appears. Show the Cancel button, let it run. | "It heard me on the device — that audio never left this phone. Ten seconds to cancel a false alarm." |
| 5 | 0:45 | Countdown hits zero → "Sending offline SMS". | "Location, one SMS segment, straight over the cellular network." |
| 6 | 0:60 | Phone B buzzes. Read the SMS aloud: coordinates + maps link. | "My contact has my coordinates — as text, because a link needs data to open." |
| 7 | 0:75 | Close. | "Audio never left the device, and this works when the cloud disappears." |

## Fallbacks (decide in the moment, don't freeze)

- **Countdown doesn't fire**: tap SOS manually — "the button path uses the same pipeline" — debug mic after.
- **SMS slow**: point at the queued state — "no signal right now, so it's queued for retry. That's the offline design working."
- **Wrong screen / crash**: backup demo video on a laptop, same beats, same lines.
- **False trigger during setup**: Cancel, smile — "that cancel button is the most important UI in the app."

## Shot list (backup video, same script)

1. Close-up: status badges with radios visibly off (3 s)
2. Wide: phone face-down, voice trigger, vibration visible (10 s)
3. Over-shoulder: countdown running down (10 s)
4. Phone B screen: SMS arriving, open it, show coordinates (10 s)
5. Talking head: the closing line (10 s)
