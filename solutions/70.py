# 70 - Climbing Stairs
# https://leetcode.com/problems/climbing-stairs/
# Patterns: dp, fibonacci

# ─── Approach 1: Bottom-up DP — O(n) time, O(1) space ───
# To reach step n, the last move was either a +1 from step n-1 or a +2 from
# step n-2 — so f(n) = f(n-1) + f(n-2) with f(0)=f(1)=1. That's the Fibonacci
# recurrence, so we don't need an array: walk forward keeping just the two
# most recent values. Each iteration shifts the window: a takes b's value
# and b becomes a + b. After n iterations a holds the answer. Constant
# space, single pass — the canonical answer for this problem.
class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 1, 1
        for _ in range(n):
            a, b = b, a + b
        return a


# ─── Approach 2: Memoized recursion — O(n) time, O(n) space ───
# Direct translation of the recurrence f(k) = f(k-1) + f(k-2). Without
# memoization this is exponential (each call branches into two). @cache
# from functools collapses the call tree by remembering each k's result —
# every distinct k is computed exactly once. Slower in practice than the
# iterative form due to call-stack and dict overhead, but the cleanest way
# to express the recurrence and a useful template when the recurrence is
# more complex than Fibonacci.
class SolutionMemo:
    def climbStairs(self, n: int) -> int:
        from functools import cache

        @cache
        def f(k: int) -> int:
            return 1 if k <= 1 else f(k - 1) + f(k - 2)

        return f(n)
