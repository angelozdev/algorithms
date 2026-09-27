"""Runs a user's Python solution against test inputs.

Protocol: one JSON request on stdin, JSON lines on fd 3 (never stdout, so user
prints cannot corrupt it). Expected values are never sent here: this process
only executes and reports what the solution returned.
"""

import contextlib
import importlib.util
import io
import json
import os
import sys
import time
import traceback

# Bytecode caches are keyed on whole-second mtime + size: a quick same-size edit
# would run stale code. Never write them (also keeps __pycache__ out of the repo).
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lc import ListNode, TreeNode  # noqa: E402

sys.setrecursionlimit(10_000)

MAX_NODES = 1_000_000
CAPTURE_LIMIT = 64 * 1024
PROTOCOL = os.fdopen(3, "w", buffering=1, encoding="utf-8")


class MissingEntryError(Exception):
    pass


class SerializationError(Exception):
    pass


class CappedBuffer(io.TextIOBase):
    """Collects printed text, keeping at most CAPTURE_LIMIT characters."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.size = 0
        self.truncated = False

    def writable(self) -> bool:
        return True

    def write(self, text: str) -> int:
        room = CAPTURE_LIMIT - self.size
        if len(text) > room:
            self.truncated = True
        if room > 0:
            self.parts.append(text[:room])
            self.size += min(len(text), room)
        return len(text)

    def getvalue(self) -> str:
        text = "".join(self.parts)
        return text + "\n… output truncated\n" if self.truncated else text


def emit(message: dict) -> None:
    PROTOCOL.write(json.dumps(message, allow_nan=False) + "\n")
    PROTOCOL.flush()


def error(kind: str, message: str, trace: str = "") -> dict:
    return {"kind": kind, "message": message, "trace": trace}


def user_trace(exc: BaseException, solution_path: str) -> str:
    frames = [
        frame
        for frame in traceback.extract_tb(exc.__traceback__)
        if os.path.abspath(frame.filename) == solution_path
    ]
    return "\n".join(
        f"  line {frame.lineno}, in {frame.name}: {(frame.line or '').strip()}"
        for frame in frames
    )


def to_list_node(values):
    dummy = ListNode()
    tail = dummy
    for value in values or []:
        tail.next = ListNode(value)
        tail = tail.next
    return dummy.next


def to_tree_node(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = [root]
    head, i = 0, 1
    while i < len(values) and head < len(queue):
        node = queue[head]
        head += 1
        if values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1
    return root


def deserialize(value, type_name: str):
    if type_name.endswith("[]"):
        return [deserialize(item, type_name[:-2]) for item in value]
    if type_name == "ListNode":
        return to_list_node(value)
    if type_name == "TreeNode":
        return to_tree_node(value)
    if type_name == "float":
        return float(value)
    return value


def from_list_node(node) -> list:
    values = []
    while node is not None:
        values.append(plain(node.val))
        node = node.next
        if len(values) > MAX_NODES:
            raise SerializationError("linked list has a cycle or more than 10^6 nodes")
    return values


def from_tree_node(root) -> list:
    if root is None:
        return []
    values: list = []
    queue = [root]
    head = 0
    while head < len(queue):
        node = queue[head]
        head += 1
        if node is None:
            values.append(None)
            continue
        values.append(plain(node.val))
        queue.append(node.left)
        queue.append(node.right)
        if len(queue) > 2 * MAX_NODES + 1:
            raise SerializationError("tree has a cycle or more than 10^6 nodes")
    while values and values[-1] is None:
        values.pop()
    return values


def plain(value):
    """Converts a returned value to JSON-friendly data (duck-typed nodes, tuples)."""
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    if hasattr(value, "val") and hasattr(value, "left") and hasattr(value, "right"):
        return from_tree_node(value)
    if hasattr(value, "val") and hasattr(value, "next"):
        return from_list_node(value)
    return value


def serialize(value, type_name):
    if type_name == "ListNode":
        return from_list_node(value)
    if type_name == "TreeNode":
        return from_tree_node(value)
    if type_name and type_name.endswith("[]") and isinstance(value, (list, tuple)):
        return [serialize(item, type_name[:-2]) for item in value]
    return plain(value)


def load_module(path: str):
    spec = importlib.util.spec_from_file_location("solution", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolve_entry(module, request: dict):
    entry = request["entry"]
    if request["mode"] == "function":
        solution = getattr(module, "Solution", None)
        if not isinstance(solution, type) or not callable(getattr(solution, entry, None)):
            raise MissingEntryError(f'expected method "{entry}" in class Solution')
        return solution
    cls = getattr(module, entry, None)
    if not isinstance(cls, type):
        raise MissingEntryError(f'expected class "{entry}"')
    return cls


def run_function(solution_cls, request: dict, raw_input):
    params = request["params"]
    args = [
        deserialize(value, param["type"])
        for value, param in zip(raw_input, params, strict=True)
    ]
    method = getattr(solution_cls(), request["entry"])
    started = time.perf_counter()
    returned = method(*args)
    ms = (time.perf_counter() - started) * 1000
    if request["discardOutput"]:
        return None, ms
    in_place = request.get("inPlace")
    if in_place:
        index = next(i for i, p in enumerate(params) if p["name"] == in_place["param"])
        output = {
            "ret": plain(returned),
            "param": serialize(args[index], params[index]["type"]),
        }
        return output, ms
    return serialize(returned, request["returns"]), ms


def run_class(cls, request: dict, raw_input):
    ops, args = raw_input["ops"], raw_input["args"]
    started = time.perf_counter()
    instance = cls(*args[0])
    results = [None]
    for op, op_args in zip(ops[1:], args[1:], strict=True):
        results.append(getattr(instance, op)(*op_args))
    ms = (time.perf_counter() - started) * 1000
    if request["discardOutput"]:
        return None, ms
    return [plain(result) for result in results], ms


def run_case(target, request: dict, case: dict, solution_path: str) -> None:
    runner = run_function if request["mode"] == "function" else run_class
    buffer = CappedBuffer()
    started = time.perf_counter()

    def fail(failure: dict) -> None:
        ms = (time.perf_counter() - started) * 1000
        emit(
            {
                "type": "case",
                "id": case["id"],
                "ok": False,
                "error": failure,
                "ms": round(ms, 3),
                "stdout": buffer.getvalue(),
            }
        )

    try:
        with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
            output, ms = runner(target, request, case["input"])
    except SerializationError as exc:
        fail(error("serialization", str(exc)))
        return
    except (Exception, SystemExit) as exc:
        name = type(exc).__name__
        fail(error("exception", f"{name}: {exc}", user_trace(exc, solution_path)))
        return
    message = {
        "type": "case",
        "id": case["id"],
        "ok": True,
        "output": output,
        "ms": round(ms, 3),
        "stdout": buffer.getvalue(),
    }
    try:
        emit(message)
    except (TypeError, ValueError) as exc:
        fail(error("serialization", f"return value is not JSON-serializable: {exc}"))


def main() -> None:
    request = json.loads(sys.stdin.read())
    solution_path = os.path.abspath(request["solutionPath"])
    try:
        with (
            contextlib.redirect_stdout(CappedBuffer()),
            contextlib.redirect_stderr(CappedBuffer()),
        ):
            module = load_module(solution_path)
    except SyntaxError as exc:
        trace = f"  line {exc.lineno}: {(exc.text or '').strip()}"
        emit({"type": "fatal", "error": error("load", f"SyntaxError: {exc.msg}", trace)})
        return
    except (Exception, SystemExit) as exc:
        message = f"{type(exc).__name__}: {exc}"
        emit({"type": "fatal", "error": error("load", message, user_trace(exc, solution_path))})
        return
    try:
        target = resolve_entry(module, request)
    except MissingEntryError as exc:
        emit({"type": "fatal", "error": error("missing-entry", str(exc))})
        return
    emit({"type": "ready"})
    for case in request["cases"]:
        emit({"type": "start", "id": case["id"]})
        run_case(target, request, case, solution_path)


if __name__ == "__main__":
    main()
