# Solutions

Python solutions for LeetCode problems. One file per problem, named `{question_number}.py`.

## File format

```python
# 70 - Climbing Stairs
# https://leetcode.com/problems/climbing-stairs/
# Patterns: dp, fibonacci

# ─── Approach 1: Bottom-up DP — O(n) time, O(1) space ───
# To reach step n, the last move was either a +1 from step n-1 or a +2 from
# step n-2 — so f(n) = f(n-1) + f(n-2) with f(0)=f(1)=1. That's the Fibonacci
# recurrence, so we don't need an array: walk forward keeping just the two
# most recent values. Constant space, single pass — the canonical answer.
class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 1, 1
        for _ in range(n):
            a, b = b, a + b
        return a


# ─── Approach 2: Memoized recursion — O(n) time, O(n) space ───
# Direct translation of the recurrence f(k) = f(k-1) + f(k-2). Without memo
# this is exponential. @cache collapses the call tree so every distinct k is
# computed exactly once. Slower in practice than the iterative form, but the
# cleanest expression of the recurrence — useful template for harder DP.
class SolutionMemo:
    def climbStairs(self, n: int) -> int:
        from functools import cache

        @cache
        def f(k: int) -> int:
            return 1 if k <= 1 else f(k - 1) + f(k - 2)

        return f(n)
```

### Conventions

- **Header**: 3 single-line comments — `# {number} - {title}`, the LeetCode URL, optional `# Patterns: …`.
- **Approach banner**: `# ─── Approach N: {label} — O(time), O(space) ───`. Use `─` line characters for visual separation.
- **Description**: a short prose block (≤ 200 words, ~3–6 lines) directly below the banner explaining the *insight* — why this approach works, what the key observation is, and any trade-off. Skip the obvious; lean on the code for the mechanics.
- **One class per approach**. The first class is named `Solution` (the preferred / submitted version). Alternatives use suffixes: `SolutionMemo`, `SolutionDP`, `SolutionTwoPointer`, etc.
- **Imports inside the method** when the approach only needs them — keeps each approach self-contained and copy-pasteable.

The dashboard auto-detects any `{n}.py` file here and renders a `</>` link on the matching row. No extra registration step.
