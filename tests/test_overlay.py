import hashlib
import json
import re
import sys
from itertools import product
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
PREFIX = "ehsandto/parcel-overlay/" + "a" * 40 + "/fixtures/"
ADOPTED = ["CLOSED", "OPEN", "CONDITIONAL"]
WITHDRAWN = ["CLOSED", "IGNORE", "CONDITIONAL"]


@pytest.fixture
def atlas(direct_deploy):
    instance = direct_deploy(str(ROOT / "contracts/ParcelOverlay.py"))
    return instance, sys.modules[type(instance._instance).__module__]


def mock(vm, name, effects, corrupt=False):
    coordinate = PREFIX + name + ".json"
    body = (ROOT / "fixtures" / (name + ".json")).read_bytes()
    vm.clear_mocks()
    vm.mock_web(re.escape("https://raw.githubusercontent.com/" + coordinate) + "$", {
        "method": "GET", "response": {"status": 200, "headers": {}, "body": body + (b" " if corrupt else b"")},
    })
    vm.mock_llm(r".*PARCEL OVERLAY EXTRACTION.*", json.dumps({"effects": effects}))
    return coordinate, hashlib.sha256(body).hexdigest()


def area(open_area, closed, conditional, inside=80, outside=0):
    return {"inside": inside, "outside": outside, "unresolved": 0, "areas": {
        label: {"certain": count, "possible": count}
        for label, count in zip(("OPEN", "CLOSED", "CONDITIONAL"), (open_area, closed, conditional))
    }}


@pytest.mark.parametrize(("name", "effects", "whole", "gate"), [
    ("adopted", ADOPTED, area(24, 26, 30), area(10, 0, 2, inside=12)),
    ("withdrawn", WITHDRAWN, area(14, 36, 30), area(0, 10, 2, inside=12)),
])
def test_validator_interpretation_changes_area(atlas, direct_vm, name, effects, whole, gate):
    contract, _ = atlas
    args = mock(direct_vm, name, effects)
    key = contract.register_map(*args)
    assert key == args[1]
    assert direct_vm.run_validator()
    assert contract.get_map(key)["effects"] == effects
    assert contract.measure(key, 0, 0, 10, 8) == whole
    assert contract.measure(key, 2, 1, 6, 4) == gate
    assert contract.measure(key, 10, 0, 11, 8) == area(0, 0, 0, inside=0, outside=8)


def test_validator_rejects_changed_semantics_and_tampered_bytes(atlas, direct_vm):
    contract, _ = atlas
    args = mock(direct_vm, "adopted", ADOPTED)
    contract.register_map(*args)
    mock(direct_vm, "adopted", WITHDRAWN)
    assert not direct_vm.run_validator()
    mock(direct_vm, "adopted", ADOPTED, corrupt=True)
    assert not direct_vm.run_validator()
    assert contract.register_map(*args) == args[1]
    assert contract.get_map(args[1])["effects"] == ADOPTED


def test_ambiguity_is_clipped_and_overwritten(atlas, direct_vm):
    contract, _ = atlas
    key = contract.register_map(*mock(direct_vm, "adopted", ["CLOSED", "UNKNOWN", "CONDITIONAL"]))
    assert contract.measure(key, 2, 1, 6, 4) == {
        "inside": 12, "outside": 0, "unresolved": 10,
        "areas": {"OPEN": {"certain": 0, "possible": 10},
                  "CLOSED": {"certain": 0, "possible": 10},
                  "CONDITIONAL": {"certain": 2, "possible": 12}},
    }
    with direct_vm.expect_revert("Invalid measurement rectangle"):
        contract.measure(key, 6, 1, 2, 4)


def test_partition_matches_unit_grid(atlas):
    _, module = atlas
    doc = json.loads((ROOT / "fixtures/adopted.json").read_bytes())
    lookup = {"OPEN": 1, "CLOSED": 2, "CONDITIONAL": 4, "UNKNOWN": 7}
    for effects in product(module.EFFECTS, repeat=3):
        canvas = {(x, y): 1 for x in range(10) for y in range(8)}
        for layer, effect in zip(doc["layers"], effects):
            if effect == "IGNORE":
                continue
            x0, y0, x1, y1 = layer["box"]
            for x in range(x0, x1):
                for y in range(y0, y1):
                    canvas[x, y] = lookup[effect]
        reconstructed = {}
        for x0, y0, x1, y1, mask in module.partition(doc, effects):
            for x in range(x0, x1):
                for y in range(y0, y1):
                    assert (x, y) not in reconstructed
                    reconstructed[x, y] = mask
        assert reconstructed == canvas
