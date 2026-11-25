# StudioNet proofs

[Deployed contract](https://explorer-studio.genlayer.com/address/0x1da327b548001DE808da10eb1a5CC209C3C473FF) ·
[Pinned source](https://github.com/ehsandto/parcel-overlay/blob/ac928d31b3114ee74593c74ffe318526b536124f/contracts/ParcelOverlay.py) ·
[Proof journal](PROOFS.json)

The deployment and both registrations finalized with `SUCCESS`, `MAJORITY_AGREE`, and recorded validator execution. The deployed source matched the pinned source after line-ending normalization. The two map readbacks returned the full committed manifest text and the expected amendment labels.

| Transaction | Agree votes | Effect labels |
| --- | --- | --- |
| [Deploy contract](https://explorer-studio.genlayer.com/tx/0x9f53e59270cedaf61cb88b56ff17fd11f87536bad735be1f61857dfba7909a99) | 4 | — |
| [Register adopted amendment](https://explorer-studio.genlayer.com/tx/0x2eb4c75632393511bf1bc5197b1494662e95af9fa14a3a52381d9c498093feb2) | 3 | CLOSED, OPEN, CONDITIONAL |
| [Register withdrawn amendment](https://explorer-studio.genlayer.com/tx/0x48ce25f8df124cb452a959bb975574cdda25917e7f57952160dd96b234e492a3) | 3 | CLOSED, IGNORE, CONDITIONAL |

| View result | Open | Closed | Conditional |
| --- | ---: | ---: | ---: |
| Adopted, full extent | 24 | 26 | 30 |
| Withdrawn, full extent | 14 | 36 | 30 |
| Adopted, gate | 10 | 0 | 2 |
| Withdrawn, gate | 0 | 10 | 2 |

All values are square units under the fictional specification. The adopted and withdrawn cases use identical rectangles. The four live measurements had zero unresolved area. The local direct tests exercise an ambiguous layer and its partial overwrite.

Run `npm ci` and `node scripts/live.mjs --verify-only` to recheck receipts, source, maps, and measurements.
