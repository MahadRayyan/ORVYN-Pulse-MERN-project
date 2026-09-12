# ORVYN Pulse 1.1 implementation notes

**Course:** Internet Application Programming  
**Submitted to:** Sir Zaeem Tariq

| Group member | Student ID |
|---|---|
| Syed Mahad Ur Rayyan | b2211006158 |
| Muhammad Uzair Madda | b2211006122 |
| Muhammad Sami Uddin | b2211006113 |
| Anas Ahmed Siddiqui | b2211006020 |

## Current scope

The MERN application connects Facebook Pages and their linked Instagram professional accounts through Meta. It provides authenticated brand workspaces, role-based access, account discovery and selection, encrypted provider tokens, bounded content imports, engagement calculations, sentiment summaries, publishing-time insights, and persisted JSON reports.

## Changes in version 1.1

Account lists, post/comment queries, report listings, and direct report retrieval now enforce imported live data. The sample-data generator and loading endpoint are removed. Setup diagnostics, callback error redirects, permission warnings, followers, synchronization status, and automatic dashboard refresh have been added. Legacy database records are excluded without deleting users or relabeling historical data.

## Data flow

React sends requests to Express. The server validates sessions and workspace membership, reads MongoDB, and computes analytics. The Meta adapter discovers authorized accounts, retrieves records, and stores account-scoped posts and comments. A Node scheduler requests periodic updates while the process is running. Tokens remain encrypted on the server.

## Verification

The frontend builds successfully. Twenty-seven unit, HTTP, and provider-contract tests passed. Tests cover live filtering, legacy report exclusion, removal of the loading endpoint, permission-dependent discovery, provider errors, Facebook/Instagram record mapping, and revoked-token handling. Provider-contract tests use mocked responses. Database integration tests are included but remain unverified in the restricted build environment. Live Meta credentials and accounts are required for actual OAuth acceptance testing.

## Supporting documentation

- `../README.md`: run commands and scope.
- `../UPGRADE.md`: existing installation migration.
- `REAL_ACCOUNTS_SETUP.md`: developer app, permissions, callback, and account connection.
- `METHODOLOGY.md`: formulas, limitations, and report behavior.

Sentiment remains English lexicon scoring. Timing recommendations remain observational. The scheduler is process-based, imports are bounded, and paid billing is outside the release. Supported Meta permissions and insight metrics must be verified for the selected API version.
