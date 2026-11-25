# ParcelOverlay — Consensus-Verified Map Amendments

**Contribution type** Builder → Intelligent Contracts

ParcelOverlay answers how much of a map window is open, closed, or conditionally accessible after a sequence of written amendments. It partitions the map along rectangle edges, applies amendments in their published order, and sums exact clipped areas.

The leader and validators independently fetch the full commit-pinned manifest and verify its SHA-256. Each uses an LLM to interpret every amendment, including whether it took effect. Consensus compares all normalized effects and the complete evidence exactly. An ambiguous amendment widens the possible area of each label wherever a later operative amendment has yet to resolve it.

The fictional fixtures use identical rectangles. Adopting a gate amendment makes 10 square units open that would otherwise remain closed. A later buffer amendment keeps the overlapping two square units conditional in both fixtures. The proof illustrates the effect of published text on an exact planar calculation.

GenVM lint and five local tests passed. An independent unit-grid calculation matched all 125 combinations of amendment effects in the fixture geometry.

StudioNet finalized the deployment and both registrations with majority agreement and recorded validator execution. Four live area queries confirmed the full-map and gate-window measurements. The deployed source matched the pinned repository source.

[GitHub repository](https://github.com/ehsandto/parcel-overlay) ·
[StudioNet deployment](https://explorer-studio.genlayer.com/address/0x1da327b548001DE808da10eb1a5CC209C3C473FF) ·
[Proofs and receipts](https://github.com/ehsandto/parcel-overlay/blob/main/LIVE_PROOFS.md)
