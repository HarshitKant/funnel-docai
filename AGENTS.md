<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Plan/quota logic lives only in `src/lib/access.server.ts` (`computeAccess`) — one source of truth for free vs Pro, used by every server fn.
- Paid report sections are stripped server-side (`redactForFree` in investigate.functions.ts) — never hide paid content only in the UI.
