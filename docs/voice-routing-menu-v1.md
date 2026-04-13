# Voice routing / IVR menu v1 (spec stub)

DTMF mapping:

| Key | Route        | Intent |
|-----|----------------|--------|
| 1   | Front desk   | Standard intake: greeting → issue capture → corrected issue confirmation → urgency → service address (if needed) → contact → callback request → estimate request → next-step confirmation → summary → owner notification |
| 2   | Emergency    | Settings-controlled: immediate forward; business-hours-only forward; bot callback intake; voicemail fallback; urgent owner/team alert |
| 3   | Existing customer | Settings-controlled: immediate forward; business-hours-only forward; bot callback intake; voicemail fallback; service follow-up alert |
| *   | Repeat menu  | Replay options |

Branch notes are authoritative in `bot_client_settings` / per-client JSON when implemented; this file is the v1 structural reference only.
