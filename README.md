# ParcelOverlay

A GenLayer contract that measures the effect of text amendments on overlapping rectangles. Readers can find how much of a rectangular query window is open, closed, or conditionally accessible.

## Registration

`register_map(coordinate, commitment)` accepts a full GitHub commit path and an exact SHA-256. The manifest supplies an extent and one to six ordered rectangles, each with an accompanying instruction. Coordinates are integers from 0 to 1000. The leader and validators each fetch and check the complete manifest, independently classify every instruction, and compare the full canonical observation exactly. The document hash keys a single immutable atlas.

## Queries

`get_map(commitment)` returns the published text, parsed rectangles, agreed effects, and a disjoint partition. The initial canvas is open. Later operative amendments override earlier ones within their rectangles. A withdrawn amendment leaves the earlier label in place. For an ambiguous amendment, its area can have any of the three labels until another operative amendment overrides it.

`measure(commitment, x0, y0, x1, y1)` clips the query against the partition and returns exact integer areas inside and outside the extent, unresolved area, and a certain and possible area for each label. Possible areas can overlap where meaning is unresolved. Geometry uses half-open rectangles in planar units.

The fictional demo keeps all geometry fixed. Adopting the gate amendment makes 10 additional square units open. Two more units of the gate are conditional in both cases because the later buffer amendment covers them.

## Development

Install `requirements-dev.txt`, run `python -m pytest tests -q`, and run `genvm-lint check contracts/ParcelOverlay.py`.
