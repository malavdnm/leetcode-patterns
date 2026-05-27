// Problem ids that have a NeetCode written solution editorial.
// Derived from every /solutions/<slug> URL in https://neetcode.io/sitemap.xml
// (973 pages), matched to ids by slug in problems.json. Each id here has a
// page at https://neetcode.io/solutions/<leetcode-slug>.
import ids from './neetcodeSolutions.json';

export default new Set(ids.map(String));
