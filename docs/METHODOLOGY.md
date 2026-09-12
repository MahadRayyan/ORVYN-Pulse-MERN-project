# Analytics methodology

## Scope and data separation

Every analytics query is scoped to an authorized workspace and imported live-account records. The interface offers rolling 7/30/90-day periods and platform filtering. Old non-live records are excluded by the server. Dates are grouped in the workspace timezone.

## Interactions

Interactions per post = likes/reactions + comment count + shares + saves.

Different platforms expose different actions. Missing non-reach counters default to zero in the current adapter; warnings identify optional unavailable metrics. Therefore cross-platform interaction totals are not perfectly comparable. The Facebook adapter does not expose saves and uses reactions in the likes field.

## Reach and engagement rate

Post reach sum = sum of available positive per-post reach values. A person who sees multiple posts can be counted repeatedly. This is not deduplicated account reach.

Engagement rate = 100 × sum(interactions for posts with positive reach) ÷ sum(reach for those same posts).

Posts with missing or zero reach do not enter this rate's numerator or denominator. Reach coverage is the percentage of selected posts with usable reach. If none has reach, the rate and reach total are null and displayed as unavailable.

## Time series

The content chart groups current cumulative interactions by the post's publication date. A point is not a daily event count: an older post may have collected those interactions over many days. Re-synchronizing can change earlier chart points.

## Posting-time suggestions

1. Convert each publication timestamp to the workspace timezone.
2. Group eligible posts by weekday and 3-hour interval.
3. Calculate each post's engagement rate, then the median for its group.
4. Display all observed buckets; recommend only buckets with at least three posts.
5. Select the qualified bucket with the highest median rate.

This is observational evidence, not a causal experiment or a guarantee of future performance. Content quality, topic, paid promotion, audience changes, outliers, and post age are not controlled. A higher minimum sample size and age-normalized snapshots are potential extensions.

## Sentiment

The system tokenizes English words and adds +1 for positive lexicon matches and -1 for negative matches. A small three-token lookback reverses a word's polarity when a negation token appears. Positive sums are positive, negative sums negative, and zero sums neutral.

Neutral includes text with no recognized English terms. The system does not reliably understand Urdu, Roman Urdu, emojis, sarcasm, implicit opinions, or complex negation. Results describe the fetched sample, not all followers or every comment. Comments are grouped by their own creation dates in the sentiment trend.

## Automatic insights

Insights are generated deterministically from current data: qualified timing windows, average interactions by content format with at least three posts, negative-comment sample proportion, and missing reach coverage. No LLM, paid AI provider, or trained predictive model is required.

## Reports

A report stores calculated results, source/platform/date filters, timezone, generation timestamp, author, and workspace. Later imports do not modify previously saved reports. Reports can contain comment text, so access is limited to authorized workspace members. Disconnecting an account removes imported working data but preserves previously created report snapshots; this is explained in the confirmation UI.
